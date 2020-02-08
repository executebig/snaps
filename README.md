# Snaps

Medium's clapping as a full-stack service, written for [_When Pigs Fly_](https://executebig.org/blog) — Execute Big's blog. 

<img src="assets/img/executebig-logo.png" width="130" alt="Execute Pig" align="right">

## Development

1. Make sure [MongoDB](https://www.mongodb.com/download-center/community) is installed.
1. Create a directory for the development database: `mkdir db`
1. Set up environment variables in `.env` (* - not required if running on Heroku)
    * `PORT`*: Port number to run it on; not required if running on Heroku
    * `HOST`: Domain that the app is being hosted on, for email link generation
    * `MONGODB_URI`*: MongoDB Connection String
    * `SALT`: Random string, used to generate validation keys
    * `MAILGUN_KEY`: Mailgun API Key
    * `MAILGUN_DOMAIN`: Mailgun sending domain
    * `MAILGUN_FROM`: Email address to send transactional emails from. Must be configured in Mailgun.
1. Install dependencies: `yarn`
1. Run MongoDB instance: `yarn db`
1. Run development server: `yarn start`

## License

Copyright (c) 2020 Execute Big & Mingjie Jiang - Released under the [MIT license](LICENSE).