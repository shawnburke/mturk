module.exports = function(config) {
  var request    = require('../lib/request')(config)
    , inherits   = require('util').inherits
    , Base       = require('./base')
    , Assignment = require('./assignment')(config)
    , ret = {};

  function HIT(hitTypeId, question, lifeTimeInSeconds, maxAssignments, requesterAnnotation) {
    this.errors = [];
    if (hitTypeId) this.hitTypeId = hitTypeId;
    if (question) this.question = question;
    if (lifeTimeInSeconds) this.lifeTimeInSeconds = lifeTimeInSeconds;
    if (maxAssignments) this.maxAssignments = maxAssignments;
    if (requesterAnnotation) this.requesterAnnotation = requesterAnnotation;
  }

  inherits(HIT, Base);

  HIT.prototype.errors = function() {
    return this.errors;
  };

  HIT.prototype.validate = function(v) {
    v.check(this.hitTypeId, 'Please enter a valid hitTypeId').notNull().isAlphanumeric();
    v.check(this.lifeTimeInSeconds, 'Please enter a lifeTimeInSeconds').notNull();
    v.check(this.lifeTimeInSeconds, 'Please enter a valid lifeTimeInSeconds').isInt();
    v.check(this.question, 'Please provide a question').notNull();
    if (this.lifeTimeInSeconds < 30) { v.error("lifeTimeInSeconds should be >= 30");  }
    if (this.lifeTimeInSeconds > 31536000) { v.error("lifeTimeInSeconds should be <= 31536000");  }
    if (this.maxAssignments) { v.check(this.maxAssignments, 'maxAssignments should be an integer').isInt(); }
    if (this.requesterAnnotation) { v.check(this.requesterAnnotation, 'Please enter a valid requesterAnnotation').len(0, 255); }
  };

  HIT.prototype.populateFromResponse = function(response) {
    Base.prototype.populateFromResponse.call(this, response, {
        HITId: 'id'
      , HITTypeId: 'hitTypeId'
      , HITStatus: 'hitStatus'
      , HITReviewStatus: 'hitReviewStatus'
    });
    if (this.requesterAnnotation) {
      try {
         this.requesterAnnotation = JSON.parse(this.requesterAnnotation);
      }
      catch (ex){
          console.log("Error parsing requesterAnnotation:" + ex.message);
          this.requesterAnnotation = null;
      }

    }
  };

  HIT.prototype.create = function(callback) {
    var self = this,
        calledback = false;

    if (! this.valid()) { return callback(this.errors); }
    var remoteErrors
      , options = {
          HITTypeId: self.hitTypeId
        , Question: this.question
        , LifetimeInSeconds: self.lifeTimeInSeconds
      };
    if (self.maxAssignments) options.MaxAssignments =  self.maxAssignments;
    if (self.requesterAnnotation) options.RequesterAnnotation =  self.requesterAnnotation;

    request('AWSMechanicalTurkRequester', 'CreateHIT', 'POST', options, "HIT", function(err, response) {
      if (err) { return callback([err]); }

      self.populateFromResponse(response.Result);
      callback(err, response);
    });
  };


  /*
   * create a HIT
   *
   * @param {hitTypeId} the HIT type id (string)
   * @param {question} the question (string)
   * @param {lifeTimeInSeconds} the lifetime, in seconds (int)
   * @param {options.maxAssignments} the maximum number of assignments. defaults to 1 (int). Optional.
   * @param {options.requesterAnnotation} annotations only viewable by the requester (you). (string with max 255 chars). Optional.
   * @param {callback} function with signature (Array errors || null, HIT hit)
   *
   */
  ret.create = function(hitTypeId, question, lifeTimeInSeconds, options, callback) {
    if (! options) options = {}
    var maxAssignments = options.maxAssignments
      , requesterAnnotation = options.requesterAnnotation
      , hit = new HIT(hitTypeId, question, lifeTimeInSeconds, maxAssignments, requesterAnnotation);

    hit.create(function(err) {
      if (err) { callback(err); return; }
      callback(null, hit);
    });
  };

 

  /*
   * force expire a HIT
   *
   * @param {hitId} the ID of the HIT to expire
   * @param {callback} function with signature (Error error || null)
   *
   */
   ret.expire = function(hitId, callback) {
     var self = this;

     request('AWSMechanicalTurkRequester', 'ForceExpireHIT', 'GET', { HITId: hitId}, callback)
   }

  /*
   * dispose of a HIT
   *
   * @param {hitId} the ID of the HIT to dispose of
   * @param {callback} function with signature (Error error || null)
   *
   */
  ret.dispose = function(hitId, callback) {
    var self = this;

    request('AWSMechanicalTurkRequester', 'DisposeHIT', 'GET', { HITId: hitId }, callback);
  }

  /*
   * Disables specified HIT.
   * 
   * @param {hitId} The ID of the HIT to retrieve (String)
   * @param {callback} function with signature (Error error || null, HIT hit)
   *
   */
  ret.disable = function(hitId, callback) {
    var self = this;

    request('AWSMechanicalTurkRequester', 'DisableHIT', 'GET', { HITId: hitId }, callback);
  };


  /*
   * Retrieves all HITs
   *
   * @param {options.sortProperty} can sort by title | reward | expiration | creationTime. Defaults to "expiration"
   * @param {options.sortDirection} can sort by Title | Reward | Expiration | CreationTime. Defaults to "Expiration"
   * @param {options.pageSize} The number of HITs to include in a page of results (int). Defaults to 10. Maximum is 100
   * @param {options.pageNumber} The page of results to return (int). Defaults to 1
   * @param {callback} function with signature (error, int numResults, int totalNumResults, int pageNumber, Array HITs)
   *
   */
   ret.search = function(options, callback) {
     if (! options) options = {};
     var requestOptions = {
         SortDirection: options.sortDirection
       , PageSize     : options.pageSize
       , PageNumber   : options.pageNumber
     };
     if (options.sortProperty) requestOptions.SortProperty = Base.objectKeyToResponseKey(options.sortProperty);


     request('AWSMechanicalTurkRequester', 'SearchHITs', 'GET', requestOptions, function(err, response) {
       var responseHits
         , hits = [];

       if (err) { callback(err); return; }



       if (! HIT.prototype.nodeExists([, 'NumResults'], response.Result)) { callback([new Error('No "SearchHITsResult > NumResults" node on the response')]); return; }
       var numResults = parseInt(response.Result.NumResults, 10);

       if (! HIT.prototype.nodeExists([ 'TotalNumResults'], response.Result)) { callback([new Error('No "SearchHITsResult > TotalNumResults" node on the response')]); return; }
       var totalNumResults = parseInt(response.Result.TotalNumResults, 10);

       if (! HIT.prototype.nodeExists([ 'PageNumber'], response.Result)) { callback([new Error('No "SearchHITsResult > PageNumber" node on the response')]); return; }
       var pageNumber = parseInt(response.Result.PageNumber, 10);
       
       if (! err) {
         responseHits = response.Result.HIT;
         if (responseHits) {
           if (! Array.isArray(responseHits)) responseHits = [responseHits];
           responseHits.forEach(function(responseHit) {
             var hit = new HIT();
             hit.populateFromResponse(responseHit);
             hits.push(hit);
           });
         }
       }
       callback(err, numResults, totalNumResults, pageNumber, hits, response);       
     });
   };

  /*
   * Retrieves the details of the specified HIT.
   *
   * @param {hitId} The ID of the HIT to retrieve (String)
   * @param {callback} function with signature (Error error || null, HIT hit)
   *
   */
  ret.get = function(hitId, callback) {
    var self = this;

    request('AWSMechanicalTurkRequester', 'GetHIT', 'GET', { HITId: hitId }, "HIT", function(err, response) {
      var hit;

      
      if (! err) {
        hit = new HIT();
        hit.populateFromResponse(response.Result);
      }
      callback(err, hit, response);
    });
  };


  /*
   * retrieves the reviewable HIT
   *
   * @param {options.hitTypeId} the HIT type id (string), not required
   * @param {options.status} the status of the HITs to retrieve  (string). Can be "Reviewable" or "Reviewing" Default: "Reviewable"
   * @param {options.sortProperty} can sort by title | reward | expiration | creationTime. Defaults to "expiration"
   * @param {options.sortDirection} can sort by Title | Reward | Expiration | CreationTime. Defaults to "Expiration"
   * @param {options.pageSize} The number of HITs to include in a page of results (int). Defaults to 10. Maximum is 100
   * @param {options.pageNumber} The page of results to return (int). Defaults to 1
   * @param {callback} function with signature (error, int numResults, int totalNumResults, int pageNumber, Array HITs)
   *
   */
  ret.getReviewable = function(options, callback) {
    if (! options) options = {};
    var requestOptions = {
        HitTypeId    : options.hitTypeId
      , Status       : options.status
      , SortDirection: options.sortDirection
      , PageSize     : options.pageSize
      , PageNumber   : options.pageNumber
    };
    if (options.sortProperty) requestOptions.SortProperty = Base.objectKeyToResponseKey(options.sortProperty);


    request('AWSMechanicalTurkRequester', 'GetReviewableHITs', 'GET', requestOptions, function(err, response) {
      var responseHits
        , hits = [];

      if (err) { callback(err); return; }

     
      if (! HIT.prototype.nodeExists([ 'NumResults'], response.Result)) { callback([new Error('No "GetReviewableHITsResult > NumResults" node on the response')]); return; }
      var numResults = parseInt(response.Result.NumResults, 10);

      if (! HIT.prototype.nodeExists(['TotalNumResults'], response)) { callback([new Error('No "GetReviewableHITsResult > TotalNumResults" node on the response')]); return; }
      var totalNumResults = parseInt(response.Result.TotalNumResults, 10);

      if (! HIT.prototype.nodeExists([ 'PageNumber'], response.Result)) { callback([new Error('No "GetReviewableHITsResult > PageNumber" node on the response')]); return; }
      var pageNumber = parseInt(response.Result.PageNumber, 10);

      if (! err) {
        responseHits = response.Result.HIT;
        if (responseHits) {
          if (! Array.isArray(responseHits)) responseHits = [responseHits];
          responseHits.forEach(function(responseHit) {
            var hit = new HIT();
            hit.populateFromResponse(responseHit);
            hits.push(hit);
          });
        }
      }
      callback(err, numResults, totalNumResults, pageNumber, hits, response);
    });

  };


  /*
   * Gets the assigments for a HIT
   *
   * @param {hitID} The ID of the HIT
   * @param {options.assignmentStatus} The status of the assignments to return (string). Valid Values: Submitted | Approved | Rejected. Default: None
   * @param {options.sortProperty} The field on which to sort the results returned by the operation (String). Valid Values: AcceptTime | SubmitTime | AssignmentStatus. Default: SubmitTime
   * @param {options.sortDirection} The direction of the sort used with the field specified by the SortProperty parameter (string). Valid Values: Ascending | Descending. Default: Ascending
   * @param {options.pageSize} The number of assignments to include in a page of results (int). Default: 10
   * @param {options.pageNumber} The page of results to return (int). Default: 1
   * @param {callback} function with signature (error, int numResults, int totalNumResults, int pageNumber, Array assignments)
   *
   */

  ret.getAssignments = function getAssignments(hitId, options, callback) {
    var inOptions = {}
    if (!options) options = {};
    inOptions.HITId = hitId;

   if (options.assignmentStatus) inOptions.AssignmentStatus = options.assignmentStatus;
   if (options.sortProperty) inOptions.SortProperty = options.sortProperty;
   if (options.sortDirection) inOptions.SortDirection = options.sortProperty;
   if (options.pageSize) inOptions.PageSize = options.pageSize;
   if (options.pageNumber) inOptions.PageNumber = options.pageNumber;

   request('AWSMechanicalTurkRequester', 'GetAssignmentsForHIT', 'GET', inOptions, function(err, response) {
     var numResults, pageNumber, totalNumResults, resultAssignments, assignments;
     if (err) { callback(err); return; }

     if (! HIT.prototype.nodeExists(['NumResults'], response.Result)) { callback([new Error('No "GetAssignmentsForHITResult > NumResults" node on the response')]); return; }
     numResults = parseInt(response.Result.NumResults, 10);

     if (! HIT.prototype.nodeExists([ 'PageNumber'], response.Result)) { callback([new Error('No "GetAssignmentsForHITResult > PageNumber" node on the response')]); return; }
     pageNumber = parseInt(response.Result.PageNumber, 10);

     if (! HIT.prototype.nodeExists(['TotalNumResults'], response.Result)) { callback([new Error('No "GetAssignmentsForHITResult > NumResults" node on the response')]); return; }
     totalNumResults = parseInt(response.Result.TotalNumResults, 10);

     resultAssignments = response.Result.Assignment;
     if (resultAssignments === undefined) {
       resultAssignments = [];
     } else {
       if (! Array.isArray(resultAssignments)) resultAssignments = [resultAssignments];
     }

     assignments = resultAssignments.map(function(resultAssignment) {
       var assignment = new Assignment();
       assignment.populateFromResponse(resultAssignment);
       return assignment;
     });

     callback(null, numResults, pageNumber, totalNumResults, assignments, response);
   });
  };


  /*
   * Gets the assigments for this HIT
   *
   * @param {options.assignmentStatus} The status of the assignments to return (string). Valid Values: Submitted | Approved | Rejected. Default: None
   * @param {options.sortProperty} The field on which to sort the results returned by the operation (String). Valid Values: AcceptTime | SubmitTime | AssignmentStatus. Default: SubmitTime
   * @param {options.sortDirection} The direction of the sort used with the field specified by the SortProperty parameter (string). Valid Values: Ascending | Descending. Default: Ascending
   * @param {options.pageSize} The number of assignments to include in a page of results (int). Default: 10
   * @param {options.pageNumber} The page of results to return (int). Default: 1
   * @param {callback} function with signature (error, int numResults, int totalNumResults, int pageNumber, Array assignments)
   *
   */
  HIT.prototype.getAssignments = function(options, callback) {
    return ret.getAssignments(this.id, options, callback);
  };

  return ret;
};