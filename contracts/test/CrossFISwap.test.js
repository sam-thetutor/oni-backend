const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrossFI Swap Contract", function () {
  let swapContract;
  let mockTUSDC;
  let owner;
  let user1;
  let user2;
  
  const INITIAL_XFI_LIQUIDITY = ethers.utils.parseEther("10"); // 10 XFI
  const INITIAL_TUSDC_LIQUIDITY = ethers.utils.parseUnits("800", 18); // 800 tUSDC (assuming 1 XFI = 80 tUSDC)

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock tUSDC token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockTUSDC = await MockERC20.deploy("Test USDC", "tUSDC", 18);
    await mockTUSDC.deployed();

    // Deploy swap contract
    const CrossFISwap = await ethers.getContractFactory("CrossFISwap");
    swapContract = await CrossFISwap.deploy(mockTUSDC.address);
    await swapContract.deployed();

    // Mint tUSDC tokens to users
    await mockTUSDC.mint(owner.address, ethers.utils.parseUnits("10000", 18));
    await mockTUSDC.mint(user1.address, ethers.utils.parseUnits("5000", 18));
    await mockTUSDC.mint(user2.address, ethers.utils.parseUnits("5000", 18));

    // Approve swap contract to spend tUSDC
    await mockTUSDC.approve(swapContract.address, ethers.constants.MaxUint256);
    await mockTUSDC.connect(user1).approve(swapContract.address, ethers.constants.MaxUint256);
    await mockTUSDC.connect(user2).approve(swapContract.address, ethers.constants.MaxUint256);
  });

  describe("Deployment", function () {
    it("Should set the correct tUSDC address", async function () {
      expect(await swapContract.tUSDC()).to.equal(mockTUSDC.address);
    });

    it("Should have zero initial reserves", async function () {
      const [xfiReserve, tusdcReserve] = await swapContract.getReserves();
      expect(xfiReserve).to.equal(0);
      expect(tusdcReserve).to.equal(0);
    });

    it("Should have zero total liquidity", async function () {
      expect(await swapContract.totalLiquidity()).to.equal(0);
    });
  });

  describe("Liquidity Management", function () {
    it("Should add initial liquidity correctly", async function () {
      await expect(
        swapContract.addLiquidity(INITIAL_TUSDC_LIQUIDITY, 0, 0, {
          value: INITIAL_XFI_LIQUIDITY,
        })
      ).to.emit(swapContract, "LiquidityAdded");

      const [xfiReserve, tusdcReserve] = await swapContract.getReserves();
      expect(xfiReserve).to.equal(INITIAL_XFI_LIQUIDITY);
      expect(tusdcReserve).to.equal(INITIAL_TUSDC_LIQUIDITY);
    });

    it("Should calculate liquidity correctly for subsequent additions", async function () {
      // Add initial liquidity
      await swapContract.addLiquidity(INITIAL_TUSDC_LIQUIDITY, 0, 0, {
        value: INITIAL_XFI_LIQUIDITY,
      });

      // Add more liquidity
      const additionalXFI = ethers.utils.parseEther("1");
      const additionalTUSDC = ethers.utils.parseUnits("80", 18);

      await expect(
        swapContract.connect(user1).addLiquidity(additionalTUSDC, 0, 0, {
          value: additionalXFI,
        })
      ).to.emit(swapContract, "LiquidityAdded");

      const [xfiReserve, tusdcReserve] = await swapContract.getReserves();
      expect(xfiReserve).to.equal(INITIAL_XFI_LIQUIDITY.add(additionalXFI));
      expect(tusdcReserve).to.equal(INITIAL_TUSDC_LIQUIDITY.add(additionalTUSDC));
    });

    it("Should remove liquidity correctly", async function () {
      // Add initial liquidity
      await swapContract.addLiquidity(INITIAL_TUSDC_LIQUIDITY, 0, 0, {
        value: INITIAL_XFI_LIQUIDITY,
      });

      const liquidityBalance = await swapContract.liquidityBalance(owner.address);
      expect(liquidityBalance).to.be.gt(0);

      // Remove half the liquidity
      const liquidityToRemove = liquidityBalance.div(2);
      
      await expect(
        swapContract.removeLiquidity(liquidityToRemove, 0, 0)
      ).to.emit(swapContract, "LiquidityRemoved");

      const newLiquidityBalance = await swapContract.liquidityBalance(owner.address);
      expect(newLiquidityBalance).to.equal(liquidityBalance.sub(liquidityToRemove));
    });
  });

  describe("Swapping", function () {
    beforeEach(async function () {
      // Add initial liquidity for swapping tests
      await swapContract.addLiquidity(INITIAL_TUSDC_LIQUIDITY, 0, 0, {
        value: INITIAL_XFI_LIQUIDITY,
      });
    });

    it("Should swap XFI for tUSDC correctly", async function () {
      const xfiToSwap = ethers.utils.parseEther("1");
      const initialTUSDCBalance = await mockTUSDC.balanceOf(user1.address);

      await expect(
        swapContract.connect(user1).swapXFIForTUSDC(0, {
          value: xfiToSwap,
        })
      ).to.emit(swapContract, "Swap");

      const finalTUSDCBalance = await mockTUSDC.balanceOf(user1.address);
      expect(finalTUSDCBalance).to.be.gt(initialTUSDCBalance);
    });

    it("Should swap tUSDC for XFI correctly", async function () {
      const tusdcToSwap = ethers.utils.parseUnits("80", 18);
      const initialXFIBalance = await user1.getBalance();

      await expect(
        swapContract.connect(user1).swapTUSDCForXFI(tusdcToSwap, 0)
      ).to.emit(swapContract, "Swap");

      const finalXFIBalance = await user1.getBalance();
      // Note: Balance comparison should account for gas costs
      expect(finalXFIBalance).to.be.gt(initialXFIBalance.sub(ethers.utils.parseEther("0.1")));
    });

    it("Should calculate swap amounts correctly", async function () {
      const xfiIn = ethers.utils.parseEther("1");
      const [xfiReserve, tusdcReserve] = await swapContract.getReserves();
      
      const expectedTUSDCOut = await swapContract.getAmountOut(xfiIn, xfiReserve, tusdcReserve);
      expect(expectedTUSDCOut).to.be.gt(0);
    });

    it("Should update price after swaps", async function () {
      const initialPrice = await swapContract.getCurrentXFIPrice();
      
      // Perform a swap that should change the price
      await swapContract.connect(user1).swapXFIForTUSDC(0, {
        value: ethers.utils.parseEther("2"),
      });

      const newPrice = await swapContract.getCurrentXFIPrice();
      expect(newPrice).to.not.equal(initialPrice);
    });

    it("Should respect slippage protection", async function () {
      const xfiToSwap = ethers.utils.parseEther("1");
      const [xfiReserve, tusdcReserve] = await swapContract.getReserves();
      const expectedOut = await swapContract.getAmountOut(xfiToSwap, xfiReserve, tusdcReserve);
      
      // Set minimum output higher than expected
      const unrealisticMin = expectedOut.mul(2);

      await expect(
        swapContract.connect(user1).swapXFIForTUSDC(unrealisticMin, {
          value: xfiToSwap,
        })
      ).to.be.revertedWithCustomError(swapContract, "ExcessiveSlippage");
    });
  });

  describe("Price Functions", function () {
    beforeEach(async function () {
      await swapContract.addLiquidity(INITIAL_TUSDC_LIQUIDITY, 0, 0, {
        value: INITIAL_XFI_LIQUIDITY,
      });
    });

    it("Should return correct XFI price", async function () {
      const xfiPrice = await swapContract.getCurrentXFIPrice();
      // Expected price: (800 * 1e18) / (10 * 1e18) = 80 * 1e18
      const expectedPrice = INITIAL_TUSDC_LIQUIDITY.mul(ethers.utils.parseEther("1")).div(INITIAL_XFI_LIQUIDITY);
      expect(xfiPrice).to.equal(expectedPrice);
    });

    it("Should return correct tUSDC price", async function () {
      const tusdcPrice = await swapContract.getCurrentTUSDCPrice();
      // Expected price: (10 * 1e18) / (800 * 1e18) = 0.0125 * 1e18
      const expectedPrice = INITIAL_XFI_LIQUIDITY.mul(ethers.utils.parseEther("1")).div(INITIAL_TUSDC_LIQUIDITY);
      expect(tusdcPrice).to.equal(expectedPrice);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to pause and unpause", async function () {
      await swapContract.pause();
      expect(await swapContract.paused()).to.be.true;

      await swapContract.unpause();
      expect(await swapContract.paused()).to.be.false;
    });

    it("Should not allow non-owner to pause", async function () {
      await expect(
        swapContract.connect(user1).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow swaps when paused", async function () {
      await swapContract.addLiquidity(INITIAL_TUSDC_LIQUIDITY, 0, 0, {
        value: INITIAL_XFI_LIQUIDITY,
      });

      await swapContract.pause();

      await expect(
        swapContract.connect(user1).swapXFIForTUSDC(0, {
          value: ethers.utils.parseEther("1"),
        })
      ).to.be.revertedWith("Pausable: paused");
    });
  });
});

// Mock ERC20 contract for testing
const MockERC20_ABI = [
  "constructor(string name, string symbol, uint8 decimals)",
  "function mint(address to, uint256 amount) external",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
];

const MockERC20_Bytecode = "0x608060405234801561001057600080fd5b506040516108a73803806108a783398101604081905261002f9161007c565b600061003b84826101a3565b50600161004883826101a3565b5060ff81166002556000600355505050610262565b634e487b7160e01b600052604160045260246000fd5b600080600060608486031215610091576100916000fd5b83516020850151604086015191955093506001600160401b038111156100b8576100b86000fd5b601f19601f82011685016040528084111560008312156100da576100da6000fd5b8351602085810191820194508084861161010e5760200285016040528481111561010657506000805260206000f35b50600014610106565b8035906020019250826040528181111561012a5761012a6000fd5b506020018560051b81018084111561014657610146600081fd5b506040908101919290915250909392505050565b634e487b7160e01b600052602260045260246000fd5b600181811c9082168061018557607f821691505b6020821081036101a55760016101a08161015b565b50919050565b601f8211156101fd57600081815260208120601f850160051c810160208610156101ca5750805b601f850160051c820191505b818110156101e9578281556001016101d6565b505050505050565b50805460008255906000526020600020908101906102259061022d565b5050565b6101fd610235565b5b8082111561024a5760008155600101610236565b5090565b61063580610271600039600";

// Helper function to deploy mock ERC20
async function deployMockERC20(name, symbol, decimals = 18) {
  const [deployer] = await ethers.getSigners();
  const factory = new ethers.ContractFactory(MockERC20_ABI, MockERC20_Bytecode, deployer);
  return await factory.deploy(name, symbol, decimals);
} 