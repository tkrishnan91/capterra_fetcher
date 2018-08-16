const request = require('request')
const cheerio = require('cheerio')
const fs = require('fs')
const url = "https://www.capterra.com/gdm_reviews?full_list=true&product_id=80432&sort_options=Most%20Recent"
const testFile = "./gdm_reviews.htm"
const content = fs.readFileSync(testFile,'utf8');
//console.log("content: " + content)
// request.get(url,{"timeout": 1500},function(error,response, body){
//   if(!error){
//     const $ = cheerio.load(body)
//     const reviews = $('div.reviews-list').toArray()

//   }else {
//     console.log(error)
//   }
// })
const $ = cheerio.load(content)
const reviewsArray = $('div.cell-review').children().toArray()

console.log("Number of reviews: " + reviewsArray.length)
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
        console.log("NPS Score: "+guageWrapper.attr('data-rating'))
    }
  return  {reviewerName: reviewerName,rating: rating}

})
console.log(reviewsArrayjson)
const slackwebhookpayload = {Name: reviewsArrayjson[0].reviewerName, NPS: reviewsArrayjson[0].rating, Reviews_To_Date:reviewsArrayjson.length,}
console.log(slackwebhookpayload)

const slackwebhook = process.env.SLACK_WEBHOOK
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
          "text":  "from " + slackwebhookpayload.Name + " \n" + "NPS score: " + slackwebhookpayload.rating + " \n" + slackwebhookpayload.Reviews_To_Date + " Reviews to Date"

      }
  ]
    
   }
 };





request(options,function(error,response, body){
    if(!error){
//console.log("works",response) 
    
      }else {
        console.log(error)
      }
})


