var EcommerceStore = artifacts.require("./EcommerceStore.sol");
var Escrow = artifacts.require("./Escrow.sol");

module.exports = function(deployer) {
  deployer.deploy(EcommerceStore);
  deployer.deploy(Escrow);
};
