## Get started

Copy variables from `example.env`

```sh
# install packages
yarn
# generate schema and prisma
dotenv -e .env yarn prepare:db
# build files
dotenv -e .env yarn build:watch
# start api
dotenv -e .env yarn start
# run prisma dashboard
dotenv -e .env yarn admin
```

## Routes

| Type   |   Route   |                   Action                   |                   Body                   |
| ------ | :-------: | :----------------------------------------: | :----------------------------------------: |
| POST    |  /start   |               Start scraper                |               `{urls: [], sessionCookieValue: "YOUR_COOKIES"}`                |
| DELETE |  /reset   |               Reset Database               |
| GET    | /instance | Get single instance data or current status |
