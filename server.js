var ecommerceStoreArtifacts = require('./build/contracts/EcommerceStore.json');
var contract = require('truffle-contract');
var Web3 = require('Web3');
var provider = new Web3.providers.HttpProvider("http://localhost:8545");
var EcommerceStore = contract(ecommerceStoreArtifacts);
EcommerceStore.setProvider(provider);

// Mongoose setup to interact with the mongodb database
var mongoose = require('mongoose');
mongoose.Promise = global.Promise;
var ProductModel = require('./product');
mongoose.connect("mongodb://localhost:27017/ebay_dapp");
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Express server which the frontend with interact with
var express = require('express');
var app = express();

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.listen(3000, function() {
  console.log('Ebay Ethereum server listening on port 3000!');
});

app.get('/products', function (req, res) {
  let currentTime = Math.round(new Date() / 1000);
  let query = { productStatus: { $eq: 0 } }

  if (Object.keys(req.query).length === 0) {
    query['auctionEndTime'] = { $gt: currentTime }
  } else if (req.query.category !== undefined) {
    query['auctionEndTime'] = { $lt: currentTime }
    query['category'] = { $eq: req.query.category }
  } else if (req.query.productStatus !== undefined) {
    if (req.query.productStatus === "reveal") {
      query['auctionEndTime'] = { $lt: currentTime, $gt: currentTime - (60 * 60) }
    } else if (req.query.productStatus === "finalize") {
      query['auctionEndTime'] = { $lt: currentTime - (60 * 60) }
      query['productStatus'] = { $eq: 0 }
    }
  }

  ProductModel.find(query, null, { sort: 'auctionEndTime' }, function (err, items) {
    if (err) {
      console.log(err);
      return;
    }
    console.log(items.length);
    res.send(items);
  })
});

app.get('/product', function (req, res) {
  let currentTime = Math.round(new Date() / 1000);
  let query = { blockchainId: { $eq: req.query.id } }

  // if (Object.keys(req.query).length === 0) {
  //   query['auctionEndTime'] = { $gt: currentTime }
  // } else if (req.query.category !== undefined) {
  //   query['auctionEndTime'] = { $lt: currentTime }
  //   query['category'] = { $eq: req.query.category }
  // } else if (req.query.productStatus !== undefined) {
  //   if (req.query.productStatus === "reveal") {
  //     query['auctionEndTime'] = { $lt: currentTime, $gt: currentTime - (60 * 60) }
  //   } else if (req.query.productStatus === "finalize") {
  //     query['auctionEndTime'] = { $lt: currentTime - (60 * 60) }
  //     query['productStatus'] = { $eq: 0 }
  //   }
  // }

  ProductModel.findOne(query, null, function (err, items) {
    if (err) {
      console.log(err);
      return;
    }
    console.log(items.length);
    res.send(items);
  })
});

function setupProductEventListner () {
  let productEvent;
  EcommerceStore.deployed().then(function (i) {
    productEvent = i.NewProduct({ fromBlock: 0, toBlock: 'latest' });

    productEvent.watch(function (err, result) {
      if (err) {
        console.log(err)
        return;
      }
      saveProduct(result.args);
    });
  })
}

setupProductEventListner();

function saveProduct (product) {
  ProductModel.findOne({ 'blockchainId': product._productId.toLocaleString() }, function (err, dbProduct) {
    if (err) {
      console.log(err)
      return;
    }

    if (dbProduct != null) {
      return;
    }

    var p = new ProductModel({ name: product._name,
      blockchainId: product._productId,
      category: product._category,
      ipfsImageHash: product._imageLink,
      ipfsDescHash: product._descLink,
      auctionStartTime: product._auctionStartTime,
      auctionEndTime: product._auctionEndTime,
      price: product._startPrice,
      condition: product._productCondition,
      productStatus: 0 });

    console.log(p);

    p.save(function (err) {
      if (err) {
        handleError(err);
      } else {
        ProductModel.count({}, function (err, count) {
          if (err) {
            console.log(err)
            return;
          }
          console.log("count is " + count);
        })
      }
    });
  })
}