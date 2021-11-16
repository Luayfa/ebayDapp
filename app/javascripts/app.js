// Import the page's CSS. Webpack will know what to do with it.
import '../stylesheets/app.css';

// Import libraries we need.
import { default as Web3 } from 'web3';
import { default as contract } from 'truffle-contract'

// Import our contract artifacts and turn them into usable abstractions.
import ecommerceStoreArtifacts from '../../build/contracts/EcommerceStore.json'

// EcommerceStore is our usable abstraction, which we'll use through the code below.
var EcommerceStore = contract(ecommerceStoreArtifacts);

const ipfsAPI = require('ipfs-api');
const ethUtil = require('ethereumjs-util');

// hosting ipfs node locally
// const ipfs = ipfsAPI({ host: 'localhost', port: '5001', protocol: 'http' });
// using infura
const ipfs = ipfsAPI({host: 'ipfs.infura.io', port: '5001', protocol: 'http'});

const offchainServer = "http://localhost:3000"; // this connects to the server, which serves from db
const categories = ["Art", "Books", "Cameras", "Cell Phones & Accessories",
                    "Clothing", "Computers & Tablets", "Gift Cards & Coupons",
                    "Musical Instruments & Gear", "Pet Supplies", "Pottery & Glass",
                    "Sporting Goods", "Tickets", "Toys & Hobbies", "Video Games"];

window.App = {
  start: () => {
    EcommerceStore.setProvider(web3.currentProvider);

    /*
    * render all products (index.html)
    */
    if ($('#store').length > 0) {
      console.log('on index.html');
      renderStore();
    }

    /*
    * list product
    */
    // take image file from form field
    var reader;
    $('#product-image').change((event) => {
      const file = event.target.files[0]
      reader = new window.FileReader()
      reader.readAsArrayBuffer(file)
    });
    // reader ex: {readyState: 2, result: ArrayBuffer(5781), error: null, ...}
    // in saveImageOnIpfs const buffer = Buffer.from(reader.result);

    // called when user press save product
    $('#add-item-to-store').submit((event) => {
      const req = $('#add-item-to-store').serialize();
      // req ex: product-name=new%20item&product-description=something&product-category=Art&product-price=5&product-condition=1&product-auction-start=2017-11-11T12%3A00&product-auction-end=1

      let params = JSON.parse('{"' + req.replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"') + '"}');
      // params ex: {product-name: 'new%20item', product-description: 'something', product-category: 'Art', ...}

      let decodedParams = {} // Create a JSON of product params

      Object.keys(params).forEach((v) => {
        decodedParams[v] = decodeURIComponent(decodeURI(params[v]));
      });
      // decodedParams ex: {product-name: 'new item 2', product-description: 'blah', product-category: 'Art', product-price: '3', product-condition: '1', …}

      saveProduct(reader, decodedParams);
      event.preventDefault();
    });

    /*
    * render product detail page (product.html)
    */
    // This if block should be with in the window.App = {} function
    if ($('#product-details').length > 0) {
      // This is product details page
      let productId = new URLSearchParams(window.location.search).get('id');
      renderProductDetails(productId);
    }

    $('#bidding').submit((event) => {
      $('#msg').hide();
      let amount = $('#bid-amount').val();
      let sendAmount = $('#bid-send-amount').val();
      let secretText = $('#secret-text').val();
      let sealedBid = '0x' + ethUtil.sha3(web3.toWei(amount, 'ether') + secretText).toString('hex');
      let productId = $('#product-id').val();
      console.log(`${sealedBid} for ${productId}`);
      EcommerceStore.deployed().then((i) => {
        i.bid(parseInt(productId), sealedBid, {value: web3.toWei(sendAmount), from: web3.eth.accounts[0], gas: 290000}).then(
          (f) => {
            $('#msg').html('Your bid has been successfully submitted!');
            $('#msg').show();
            console.log(f);
          })
        });
      event.preventDefault();
    })

    $('#revealing').submit((event) => {
      $('#msg').hide();
      let amount = $('#actual-amount').val();
      let secretText = $('#reveal-secret-text').val();
      let productId = $('#product-id').val();
      EcommerceStore.deployed().then((i) => {
        i.revealBid(parseInt(productId), web3.toWei(amount).toString(), secretText, { from: web3.eth.accounts[0], gas: 440000 })
        .then((f) => {
          $('#msg').show();
          $('#msg').html('Your bid has been successfully revealed!');
          console.log(f)
        })
      });
      event.preventDefault();
    });

    $('#finalize-auction').submit((event) => {
      $('#msg').hide();
      let productId = $('#product-id').val();
      
      EcommerceStore.deployed().then((i) => {
        i.finalizeAuction(parseInt(productId), {from: web3.eth.accounts[0], gas: 4400000})
          .then((f) => {
            $('#msg').show();
            $('#msg').html('The auction has been finalized and winner declared.');
            console.log(f)
            window.location.reload();
          }).catch((e) => {
            console.log(e);
            $('#msg').show();
            $('#msg').html('The auction can not be finalized by the buyer or seller, only a third party aribiter can finalize it');
          })
      });
      event.preventDefault();
    });

    $('#release-funds').click(() => {
      let productId = new URLSearchParams(window.location.search).get('id');
      EcommerceStore.deployed().then((f) => {
        $('#msg').html('Your transaction has been submitted. Please wait for few seconds for the confirmation').show();
        console.log(productId);
        f.releaseAmountToSeller(productId, { from: web3.eth.accounts[0], gas: 440000 })
        .then((f) => {
          console.log(f);
          window.location.reload();
        }).catch((e) => {
          console.log(e);
        })
      });
    });

    $('#refund-funds').click(() => {
      let productId = new URLSearchParams(window.location.search).get('id');
      EcommerceStore.deployed().then((f) => {
        $('#msg').html('Your transaction has been submitted. Please wait for few seconds for the confirmation').show();
        f.refundAmountToBuyer(productId, { from: web3.eth.accounts[0], gas: 440000 })
        .then((f) => {
          console.log(f);
          window.location.reload();
        }).catch((e) => {
          console.log(e);
        })
      });

      alert("refund the funds!");
    });
  }
};

/***************************************************
  RENDER STORE ON LOAD
  (from off chain server)
****************************************************/

function renderStore () {
  renderProducts("product-list", {});
  renderProducts("product-reveal-list", { productStatus: "reveal" });
  renderProducts("product-finalize-list", { productStatus: "finalize" });
  categories.forEach((value) => {
    $("#categories").append("<div>" + value + "");
  })
}

function renderProducts (div, filters) {
  $.ajax({
    url: offchainServer + "/products",
    type: 'get',
    contentType: "application/json; charset=utf-8",
    data: filters // which goes here
  }).done((data) => {
    if (data.length === 0) {
      $("#" + div).html('No products found');
    } else {
      $("#" + div).html('');
    }
    while (data.length > 0) {
      let chunks = data.splice(0, 4);
      let row = $("<div/>");
      row.addClass("row");
      chunks.forEach((value) => {
        let node = buildProduct(value);
        row.append(node);
      })
      $("#" + div).append(row);
    }
  })
}

function buildProduct (product) {
  console.log(product);
  let node = $(`<div/>`);
  node.addClass(`col-sm-3 text-center col-margin-bottom-1`);
  node.append(`<img src='https://ipfs.io/ipfs/${product.ipfsImageHash}' width='150px' />`);
  node.append(`<div>${product.name}</div>`);
  node.append(`<div>${product.category}</div>`);
  node.append(`<div>Auction start time: ${product.auctionStartTime}</div>`);
  node.append(`<div>Auction end time: ${product.auctionEndTime}</div>`);
  node.append(`<div>Ether: ${product.price}</div>`);
  return node;
}

/***************************************************
  RENDER STORE ON LOAD
  (from blockchain)
****************************************************/

// function renderStore () {
//   EcommerceStore.deployed().then((i) => {

//     let index = 0;

//     i.productIndex.call().then((n) => {
//       index = parseInt(n);
//       console.log('index: ', index);
//       $('#total-products').html(index.toString());

//       for (let y = 0; y < index; y++) {
//         i.getProductInfo.call(y).then((pi) => {
//           let product = pi;
//           // product.push(pi);
//           i.getProductAuctionInfo.call(y).then((pa) => {
//             for (var x = 0; x < pa.length; x++) {
//               product.push(pa[x]);
//             }
//             console.log('product list: ', product);
//             $('#product-list').append(buildProduct(product));
//           })
//         });
//       }
//     }).catch((err) => {
//       console.log(err);
//     });
//   })
// }

// function buildProduct (product) {
//   const [id, name, category, imageLink, descLink,
//         auctionStartTime, auctionEndTime, startPrice] = product;
//   let node = $(`<div/>`);
//   node.addClass(`col-sm-3 text-center col-margin-bottom-1`);
//   node.append(`<img src='https://ipfs.io/ipfs/${imageLink}' width='150px' />`);
//   node.append(`<div>${name}</div>`);
//   node.append(`<div>${category}</div>`);
//   node.append(`<div>Auction start time: ${auctionStartTime}</div>`);
//   node.append(`<div>Auction end time: ${auctionEndTime}</div>`);
//   node.append(`<div>Ether: ${startPrice}</div>`);
//   return node;
// }

/***************************************************
  SAVE PRODUCT TO BLOCKCHAIN

****************************************************/

function saveProduct (reader, decodedParams) {
  let imageId, descId;
  saveImageOnIpfs(reader).then((id) => {
    // hash returned from IPFS
    imageId = id;
    saveTextBlobOnIpfs(decodedParams['product-description']).then((id) => {
      // hash returned from IPFS
      descId = id;
      saveProductToBlockchain(decodedParams, imageId, descId);
    })
  })
}

function saveProductToBlockchain (params, imageId, descId) {
  console.log(params);
  console.log(imageId, descId);
  let auctionStartTime = Date.parse(params['product-auction-start']) / 1000;
  let auctionEndTime = auctionStartTime + parseInt(params['product-auction-end']) * 24 * 60 * 60;

  console.log('product-condition: ', params['product-condition']);

  EcommerceStore.deployed().then((i) => {
    i.addProductToStore(params['product-name'], params['product-category'], imageId, descId, auctionStartTime, auctionEndTime, web3.toWei(params['product-price'], 'ether'), parseInt(params['product-condition']), { from: web3.eth.accounts[0], gas: 4300000 })
    .then((f) => {
      console.log(f);
      $('#msg').show();
      $('#msg').html('Your product was successfully added to your store!');
    })
  });
}

/*
  Create new promise to save image on IPFS.
  Call this in saveProduct().
*/
function saveImageOnIpfs (reader) {
  return new Promise((resolve, reject) => {
    const buffer = Buffer.from(reader.result);
    ipfs.add(buffer)
    .then((response) => {
      console.log(response)
      resolve(response[0].hash);
    }).catch((err) => {
      console.error(err)
      reject(err);
    })
  })
}

/*
  Create new promise to save description on IPFS.
  Call this in saveProduct().
*/
function saveTextBlobOnIpfs (blob) {
  return new Promise((resolve, reject) => {
    const descBuffer = Buffer.from(blob, 'utf-8');
    ipfs.add(descBuffer)
    .then((response) => {
      console.log(response)
      resolve(response[0].hash);
    }).catch((err) => {
      console.error(err)
      reject(err);
    })
  })
}

/***************************************************
  RENDER PRODUCT DETAILS
  (query db)
  TODO: build product details
****************************************************/

function renderProductDetails (productId) {
  $.ajax({
    url: offchainServer + "/product",
    type: 'get',
    contentType: "application/json; charset=utf-8",
    data: { id: productId } // which goes here
  }).done((data) => {
    if (data.length === 0) {
      console.log("not found");
    } else {
      console.log("found!");
      console.log(data);
    }
  })
}

/***************************************************
  RENDER PRODUCT DETAILS
  (query blockchain)
****************************************************/

// function renderProductDetails (productId) {
//   EcommerceStore.deployed().then((i) => {
//     i.getProductInfo.call(productId).then((pi) => {
//       // console.log(pi);
//       var p = pi;

//       i.getProductAuctionInfo.call(productId).then((pa) => {
//         for (let x = 0; x < pa.length; x++) {
//           p.push(pa[x]);
//         }

//         let content = '';
//         const [id, name, category, imageLink, descLink,
//               auctionStartTime, auctionEndTime, startPrice,
//               highestBidder, highestBid, secondHighestBid,
//               totalBids, status] = p;

//         console.log('image hash', imageLink);
//         console.log('total bids', parseInt(totalBids));

//         ipfs.cat(descLink).then((stream) => {
//           stream.on('data', (chunk) => {
//             // do stuff with this chunk of data
//             content += chunk.toString();
//             $('#product-desc').append(`<div>${content}</div>`);
//           })
//         });

//         $('#product-image').append(`<img src='https://ipfs.io/ipfs/${imageLink}' width='250px' />`);
//         $('#product-price').html(displayPrice(startPrice));
//         $('#bid-total').html(parseInt(totalBids));
//         $('#product-name').html(name);
//         $('#product-auction-end').html(displayEndHours(auctionEndTime));
//         $('#product-id').val(id);
//         $('#revealing, #bidding').hide();
//         let currentTime = getCurrentTimeInSeconds();

//         if (parseInt(status) === 1) {
//           // $('#product-status').html('Product sold.');
//           EcommerceStore.deployed().then((i) => {
//             $('#escrow-info').show();
//             i.highestBidderInfo.call(productId).then((f) => {
//               const [highestBidder, highestBid, secondHighestBid] = f;
//               if (secondHighestBid.toLocaleString() === '0') {
//                 $('#product-status').html('Auction has ended. No bids were revealed');
//               } else {
//               $('#product-status').html(`Auction has ended. Product sold to ${highestBidder} for ${displayPrice(secondHighestBid)}
//               The money is in the escrow. Two of the three participants (Buyer, Seller and Arbiter) have to 
//               either release the funds to seller or refund the money to the buyer`);
//               }
//             })
//             i.escrowInfo.call(productId).then((f) => {
//               const [buyer, seller, arbiter, amount, fundsDisbursed, releaseCount, refundCount] = f;
//               $('#buyer').html(`Buyer: ${buyer}`);
//               $('#seller').html(`Seller: ${seller}`);
//               $('#arbiter').html(`Arbiter: ${arbiter}`);
//               if(fundsDisbursed) {
//                 $('#release-count').html('Amount from the escrow has been released.');
//               } else {
//                 $('#release-count').html(`${releaseCount} of 3 participants have agreed to release funds.`);
//                 $('#refund-count').html(`${refundCount} of 3 participants have agreed to refund the buyer.`);
//               }
//             })
//           })
//         } else if (parseInt(status) === 2) {
//           $('#product-status').html('Product was not sold.');
//         } else if (currentTime < auctionEndTime) {
//           $('#bidding').show();
//         } else if (currentTime < auctionEndTime + 600) {
//           $('#revealing').show();
//         } else {
//           $('#finalize-auction').show();
//         }
//       })
//     })
//   })
// }

function getCurrentTimeInSeconds () {
 return Math.round(new Date() / 1000);
}

function displayPrice (amt) {
 return `Ξ ${web3.fromWei(amt, 'ether')}`;
}

function displayEndHours (seconds) {
  let currentTime = getCurrentTimeInSeconds()
  let remainingSeconds = seconds - currentTime;

  if (remainingSeconds <= 0) {
    return 'Auction has ended';
  }

  let days = Math.trunc(remainingSeconds / (24 * 60 * 60));

  remainingSeconds -= days * 24 * 60 * 60
  let hours = Math.trunc(remainingSeconds / (60 * 60));

  remainingSeconds -= hours * 60 * 60

  let minutes = Math.trunc(remainingSeconds / 60);

  if (days > 0) {
    return `Auction ends in ${days} days, ${hours} hours, ${minutes} minutes`;
  } else if (hours > 0) {
    return `Auction ends in ${hours} hours, ${minutes} minutes`;
  } else if (minutes > 0) {
    return `Auction ends in ${minutes} minutes`;
  } else {
    return `Auction ends in ${remainingSeconds} seconds`;
  }
}

/***************************************************
  ON LOAD

****************************************************/
window.addEventListener('load', () => {
  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof web3 !== 'undefined') {
    console.warn(`Using web3 detected from external source. If you find that your accounts don't appear or you have 0 MetaCoin, ensure you've configured that source properly. If using MetaMask, see the following link. Feel free to delete this warning. :) http://truffleframework.com/tutorials/truffle-and-metamask`)
    // Use Mist/MetaMask's provider
    window.web3 = new Web3(web3.currentProvider);
  } else {
    console.warn(`No web3 detected. Falling back to http://localhost:8545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask`);
    // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
    //window.web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
    window.web3 = new Web3(new Web3.providers.HttpProvider("https://ropsten.infura.io/jhjrbwmschPDuoq0On2g"));
  }

  App.start();
});
