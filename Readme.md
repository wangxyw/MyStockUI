## Install 
```
npm install 


```

## Config
config/database.yml


## Config
yarn start_dev  //to start front-end
yarn start      //to start nodejs server, default port:3005, use 'PORT:*** yarn start' to start on your port

## Update trading days
node ./routes/caculate_date.js ${year} //Update once a year after offical holidays is announced e.g. node caculate_date.js 2023