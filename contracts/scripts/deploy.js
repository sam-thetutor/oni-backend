const hre = require("hardhat");

async function main() {
  // tUSDC contract address on CrossFI testnet
  const TUSDC_ADDRESS = "0xc5C6691c4A6264eF595F1fdEBc7AC077bdD1Ee50";
  
  console.log("Deploying CrossFI Swap Contract...");
  console.log("Network:", hre.network.name);
  console.log("tUSDC Address:", TUSDC_ADDRESS);
  
  // Get the deployer account
  const signers = await hre.ethers.getSigners();
  
  if (signers.length === 0) {
    console.error("❌ No deployer account found!");
    console.error("Please create a .env file with your PRIVATE_KEY:");
    console.error("");
    console.error("# .env file content:");
    console.error("PRIVATE_KEY=your_wallet_private_key_without_0x_prefix");
    console.error("");
    console.error("Make sure your wallet has XFI tokens for gas fees on CrossFI testnet.");
    process.exit(1);
  }
  
  const deployer = signers[0];
  console.log("Deploying contracts with account:", deployer.address);
  
  // Check deployer balance
  const balance = await deployer.getBalance();
  console.log("Account balance:", hre.ethers.utils.formatEther(balance), "XFI");
  
  if (balance.lt(hre.ethers.utils.parseEther("0.1"))) {
    console.warn("Warning: Low balance. Make sure you have enough XFI for deployment and gas fees.");
  }
  
  // Deploy the CrossFI Swap contract
  const CrossFISwap = await hre.ethers.getContractFactory("CrossFISwap");
  const swapContract = await CrossFISwap.deploy(TUSDC_ADDRESS);
  
  console.log("Deploying... Transaction hash:", swapContract.deployTransaction.hash);
  
  // Wait for deployment to be mined
  await swapContract.deployed();
  
  console.log("✅ CrossFI Swap Contract deployed successfully!");
  console.log("📍 Contract address:", swapContract.address);
  console.log("🔗 Transaction hash:", swapContract.deployTransaction.hash);
  
  // Verify initial state
  const tUSDCAddress = await swapContract.tUSDC();
  const [xfiReserve, tusdcReserve] = await swapContract.getReserves();
  
  console.log("\n📊 Initial Contract State:");
  console.log("tUSDC Token:", tUSDCAddress);
  console.log("XFI Reserve:", hre.ethers.utils.formatEther(xfiReserve));
  console.log("tUSDC Reserve:", hre.ethers.utils.formatUnits(tusdcReserve, 18));
  console.log("Total Liquidity:", await swapContract.totalLiquidity());
  
  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    contractAddress: swapContract.address,
    tUSDCAddress: TUSDC_ADDRESS,
    deployerAddress: deployer.address,
    transactionHash: swapContract.deployTransaction.hash,
    blockNumber: swapContract.deployTransaction.blockNumber,
    deployedAt: new Date().toISOString(),
  };
  
  console.log("\n📄 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  // Optionally verify contract on explorer (if supported)
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n🔍 Waiting 30 seconds before verification...");
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    try {
      await hre.run("verify:verify", {
        address: swapContract.address,
        constructorArguments: [TUSDC_ADDRESS],
      });
      console.log("✅ Contract verified on explorer");
    } catch (error) {
      console.log("❌ Verification failed:", error.message);
    }
  }
  
  console.log("\n🎉 Deployment completed successfully!");
  console.log("\n🚀 Next steps:");
  console.log("1. Add liquidity to the pool using addLiquidity()");
  console.log("2. Update your backend with the new contract address");
  console.log("3. Test swaps with small amounts first");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 