const request = require('request')
const cheerio = require('cheerio')
const fs = require('fs')
const AWS = require('aws-sdk');
const path = require('path');
var sha1 = require('hash-anything').sha1;
const url = "https://www.capterra.com/gdm_reviews?full_list=true&product_id=80432&sort_options=Most%20Recent"
const testFile = "./gdm_reviews.htm"
const content = fs.readFileSync(testFile,'utf8');

//scrape the site //function - done
//process entries //function - done
//hash the first entry
//retrieve last hash from S3 //function - done
//compare hashes
//post message and update s3 //function -done

//Functions

function scrapeSite(url, callback) {
  // Make get request to Capterra
  return request.get(url, { "timeout": 10000 }, function (error, response, body) {
    if (!error) {
      const $ = cheerio.load(body)
      const reviews = $('div.reviews-list').toArray()
      return callback(reviews)
    } else {
      return error
    }
  })
}
function s3Upload(s3Load) {
  //Configure AWS environment
  AWS.config.update({
    accessKeyId: process.env.AWSAccessKeyId,
    secretAccessKey: process.env.AWSSecretKey
  });
  var s3 = new AWS.S3();
  //Configure parameters and upload file
  var params = {
    Bucket: 'capterrabucket',
    Body: JSON.stringify(s3Load),
    Key: "hashfile"
  };
  s3.upload(params, function (err, data) {
    if (err) {
      console.log("Error", err);
    }
    if (data) {
      console.log("Uploaded in:", data.Location);
    }
  });
}

function getLatestReviewerDetails(reviews) {
  const $ = cheerio.load(reviews)
  const reviewsArray = $('div.cell-review').children().toArray()
  console.log("Number of reviews: " + reviewsArray.length)
  // Create Review Detail Array with Name and Rating
  const reviewsArrayjson = reviewsArray.map((review) => {
    var review = cheerio.load(review)
    let reviewDetails = review('.reviewer-details').first().children()
    let reviewerName = reviewDetails.first().text()
    console.log("Name: " + reviewerName)
    //gauge-wrapper" data-rating="6.0"
    let guageWrapper = review('[data-rating]')
    let rating = "NONE"
    if (guageWrapper.attr('data-rating')) {
      rating = guageWrapper.attr('data-rating')
      console.log("NPS Score: " + guageWrapper.attr('data-rating'))
    }
    return { reviewerName: reviewerName, rating: rating }
  })
  // Capture Reviews to Date
  reviewsArrayjson[0].reviewsToDate = reviewsArrayjson.length
  return reviewsArrayjson[0]
}

function retrieveHashFromS3(callback) {
  //Reconfigure AWS environment
  AWS.config.update({
    accessKeyId: process.env.AWSAccessKeyId ,
    secretAccessKey: process.env.AWSSecretKey
  });
  var s3 = new AWS.S3();
  //Reconstruct parameters to get hashurl value
  var params = {
    Bucket: 'capterrabucket',
    Key: "hashfile"
  }
  //Read Hash Value from S3
  s3.getObject(params, (err, data) => {
    if (err) {
      console.log(err.stack);
    } else {
      var s3Output = data.Body.toString()
      var hashFromS3 = JSON.parse(s3Output).hash
      console.log("Hash Value from S3:" + hashFromS3);
      callback(hashFromS3)
    }
  })
}
function createSlackNotification(reviewerName, rating, reviewsToDate) {
  // Create slackwebhook enivronmental variable
  const slackwebhook = process.env.SLACK_WEBHOOK
  // Slack Attachment
  var options = {
    uri: slackwebhook,
    method: 'POST',
    json: {
      "attachments": [
        {
          "fallback": "Required plain-text summary of the attachment.",
          "color": "#2C3849",
          "pretext": "Attention PSM Team",
          "title": "New Review",
          "title_link": "https://www.capterra.com/p/80432/Jama/",
          "text": "from " + reviewerName + " \n" + "NPS score: " + rating + " \n" + reviewsToDate + " Reviews to Date"
        }
      ]
    }
  }
  return options
}
function compareHash(latestReview, hashOfLatestReview, hashFromS3) {
  if (hashOfLatestReview === hashFromS3) {
    console.log("No review changes in Capterra")
  }
  // If hash values have changed call createSlackNotification and update AWS S3 with reviewer details 
  else {
    const slackPayLoad = createSlackNotification(latestReview.reviewerName, latestReview.rating, latestReview.reviewsToDate)
    request.post(slackPayLoad)
    s3Load = {
      'hash': hashOfLatestReview,
      'reviewerName': latestReview.reviewerName,
      'rating': latestReview.rating
    }
    s3Upload(s3Load)
  }
}
// Calling AWS Lambda Function exports.handler = (event, context, callback) => {
scrapeSite(url, (reviews) => {
  const latestReview = getLatestReviewerDetails(reviews); //Get URL and Process Entries for hash review
  const hashOfLatestReview = sha1(latestReview);
  console.log("Hash of latest review: " + hashOfLatestReview);
  retrieveHashFromS3((hashFromS3) => compareHash(latestReview, hashOfLatestReview, hashFromS3))
});
//};