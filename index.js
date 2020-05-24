const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const { google } = require('googleapis');

const { client, secret, redirect } = functions.config().oauth;
const { video_id } = functions.config().data;

const oauth2Client = new google.auth.OAuth2(client, secret, redirect);


async function updateVideoTitle() {
  // Get refresh_token from DB
  const tokens = (await admin.firestore().doc('tokens/userID').get()).data();
  oauth2Client.setCredentials(tokens);

  // YouTube client
  const youtube = google.youtube({
    version: 'v3',
    auth: oauth2Client,
  });

  // Get video
  const result = await youtube.videos.list({
    id: video_id,
    part: 'statistics,snippet',
  });

  const video = result.data.items[0];
  const oldTitle = video.snippet.title;

  const { viewCount, likeCount, dislikeCount } = video.statistics;

  const newTitle = `How RESTful APIs work | this video has ${viewCount} views`;

  video.snippet.title = newTitle;

  // Update video
  const updateResult = await youtube.videos.update({
    requestBody: {
      id: video_id,
      snippet: {
        title: newTitle,
        categoryId: video.snippet.categoryId,
      },
    },
    part: 'snippet',
  });

  console.log(updateResult.status);

  return {
    oldTitle,
    newTitle,
    video,
  };
}

exports.updateVideoJob = functions.pubsub
  .schedule('every 3 minutes')
  .onRun((context) => updateVideoTitle());

// OAuth Code

exports.createAndSaveTokens = functions.https.onRequest(async (req, res) => {
  const code = req.body.code;
  const { tokens } = await oauth2Client.getToken(code);
  const { refresh_token } = tokens;

  // TODO get userID

  await admin.firestore().doc('tokens/userID').set({ refresh_token });
  res.send('success');
});

exports.getAuthURL = functions.https.onRequest(async (req, res) => {
  const scopes = [
    'profile',
    'email',
    'https://www.googleapis.com/auth/youtube',
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });

  res.send(url);
});
