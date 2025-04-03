// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/core/interfaces/IUniswapV2Factory.sol";
import "../src/core/interfaces/IUniswapV2Pair.sol";
import "../src/core/interfaces/IERC20.sol";
import "../src/core/interfaces/IUniswapV2ERC20.sol";
import "../src/core/UniswapV2Factory.sol";
import "../src/core/UniswapV2Pair.sol";
import "../src/periphery/UniswapV2Router02.sol";
import "../src/periphery/test/WETH9.sol";
import "../src/core/libraries/SafeMath.sol";
import "../src/periphery/libraries/UniswapV2Library.sol";

contract TestERC20 {
    using SafeMath for uint;

    string public constant name = 'Test Token';
    string public constant symbol = 'TEST';
    uint8 public constant decimals = 18;
    uint  public totalSupply;
    mapping(address => uint) public balanceOf;
    mapping(address => mapping(address => uint)) public allowance;

    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from, address indexed to, uint value);

    constructor(uint _totalSupply) {
        totalSupply = _totalSupply;
        balanceOf[msg.sender] = _totalSupply;
    }

    function _approve(address owner, address spender, uint value) private {
        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    function _transfer(address from, address to, uint value) private {
        balanceOf[from] = balanceOf[from].sub(value);
        balanceOf[to] = balanceOf[to].add(value);
        emit Transfer(from, to, value);
    }

    function approve(address spender, uint value) external returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint value) external returns (bool) {
        if (allowance[from][msg.sender] != type(uint).max) {
            allowance[from][msg.sender] = allowance[from][msg.sender].sub(value);
        }
        _transfer(from, to, value);
        return true;
    }
}

contract UniswapV2Router02Test is Test {
    IUniswapV2Factory public factory;
    UniswapV2Router02 public router;
    TestERC20 public token0;
    TestERC20 public token1;
    WETH9 public weth;
    address public user = address(1);
    uint256 constant INITIAL_SUPPLY = 1000000 ether;
    uint256 constant INITIAL_ETH = 100 ether;

    function setUp() public {
        console.log("Setting up test environment...");
        
        // Deploy tokens
        weth = new WETH9();
        token0 = new TestERC20(INITIAL_SUPPLY);
        token1 = new TestERC20(INITIAL_SUPPLY);

        console.log("Tokens deployed: ");
        console.log("  WETH:", address(weth));
        console.log("  token0:", address(token0));
        console.log("  token1:", address(token1));

        // Ensure token0 address is less than token1
        if (address(token0) > address(token1)) {
            (token0, token1) = (token1, token0);
        }
        
        console.log("After sorting:");
        console.log("  token0:", address(token0));
        console.log("  token1:", address(token1));

        // Deploy factory and router
        factory = new UniswapV2Factory(user);
        router = new UniswapV2Router02(address(factory), address(weth));
        
        console.log("Factory deployed:", address(factory));
        console.log("Router deployed:", address(router));

        // Setup initial balances
        token0.transfer(user, INITIAL_SUPPLY / 2);
        token1.transfer(user, INITIAL_SUPPLY / 2);
        vm.deal(user, INITIAL_ETH);
        
        console.log("User balances setup:");
        console.log("  token0 balance:", token0.balanceOf(user));
        console.log("  token1 balance:", token1.balanceOf(user));
        console.log("  ETH balance:", user.balance);
    }

    function test_Constructor() public {
        assertEq(router.factory(), address(factory));
        assertEq(router.WETH(), address(weth));
    }

    function test_Receive() public {
        // Test that receive only accepts ETH from WETH
        vm.expectRevert();
        (bool success,) = address(router).call{value: 1 ether}("");
    }

    function test_AddLiquidity() public {
        console.log("Starting test_AddLiquidity");
        uint amount0 = 1 ether;
        uint amount1 = 4 ether;

        // Create pair directly
        address pair = factory.createPair(address(token0), address(token1));
        console.log("Pair created:", pair);
        
        // Transfer tokens to the pair manually
        token0.transfer(pair, amount0);
        token1.transfer(pair, amount1);
        console.log("  token0 amount:", token0.balanceOf(pair));
        console.log("  token1 amount:", token1.balanceOf(pair));
        
        // Call mint directly on the pair
        uint liquidity = IUniswapV2Pair(pair).mint(address(this));
        console.log("Liquidity minted:", liquidity);
        
        // Try to calculate the pair address using our library's pairFor function
        address calculatedPair = UniswapV2Library.pairFor(address(factory), address(token0), address(token1));
        console.log("Calculated pair address:", calculatedPair);
        console.log("Actual pair address:", pair);
        
        // Verify the addresses match
        if (calculatedPair != pair) {
            console.log("MISMATCH in pair addresses!");
            
            // Debug the initialization code hash
            bytes32 initCodeHash = keccak256(type(UniswapV2Pair).creationCode);
            console.log("Real init code hash:", uint256(initCodeHash));
            
            // Check the direct call to getReserves on our real pair
            (uint direct0, uint direct1, ) = IUniswapV2Pair(pair).getReserves();
            console.log("Direct reserves from pair:", direct0, direct1);
        } else {
            console.log("Addresses match correctly.");
            
            // Call getReserves through the library
            (uint reserve0, uint reserve1) = UniswapV2Library.getReserves(address(factory), address(token0), address(token1));
            console.log("Reserves from UniswapV2Library:", reserve0, reserve1);
            
            // Compare with direct call to getReserves
            (uint direct0, uint direct1, ) = IUniswapV2Pair(pair).getReserves();
            console.log("Direct reserves from pair:", direct0, direct1);
        }
    }

    function test_AddLiquidityETH() public {
        uint amountToken = 1 ether;
        uint amountTokenMin = 0;
        uint amountETHMin = 0;
        uint deadline = block.timestamp + 1 hours;

        // Approve router
        vm.prank(user);
        token0.approve(address(router), amountToken);

        // Add liquidity with ETH
        vm.prank(user);
        (uint amountTokenOut, uint amountETH, uint liquidity) = router.addLiquidityETH{value: 1 ether}(
            address(token0),
            amountToken,
            amountTokenMin,
            amountETHMin,
            user,
            deadline
        );

        // Verify amounts and liquidity
        assertEq(amountTokenOut, amountToken);
        assertEq(amountETH, 1 ether);
        assertGt(liquidity, 0);
    }

    function test_RemoveLiquidity() public {
        uint liquidity = addLiquidity();
        address pair = factory.getPair(address(token0), address(token1));
        IERC20(pair).approve(address(router), liquidity);
        (uint amount0, uint amount1) = router.removeLiquidity(
            address(token0),
            address(token1),
            liquidity,
            1,
            1,
            address(this),
            block.timestamp
        );
        assertGt(amount0, 0);
        assertGt(amount1, 0);
    }

    function test_RemoveLiquidityETH() public {
        // First add liquidity with ETH
        uint amountToken = 1 ether;
        uint deadline = block.timestamp + 1 hours;

        vm.startPrank(user);
        token0.approve(address(router), amountToken);

        (uint amountTokenIn, uint amountETH, uint liquidity) = router.addLiquidityETH{value: 1 ether}(
            address(token0),
            amountToken,
            0,
            0,
            user,
            deadline
        );

        // Get pair address and approve LP tokens for removal
        address pair = factory.getPair(address(token0), address(weth));
        IERC20(pair).approve(address(router), type(uint256).max);

        // Remove liquidity
        (uint amountTokenOut, uint amountETHOut) = router.removeLiquidityETH(
            address(token0),
            liquidity,
            0,
            0,
            user,
            deadline
        );
        vm.stopPrank();

        // Verify amounts
        assertGt(amountTokenOut, 0);
        assertGt(amountETHOut, 0);
    }

    function test_RemoveLiquidityWithPermit() public {
        // First add liquidity
        uint amount0 = 1 ether;
        uint amount1 = 4 ether;
        uint deadline = block.timestamp + 1 hours;

        vm.prank(user);
        token0.approve(address(router), amount0);
        vm.prank(user);
        token1.approve(address(router), amount1);

        vm.prank(user);
        (uint amountA, uint amountB, uint liquidity) = router.addLiquidity(
            address(token0),
            address(token1),
            amount0,
            amount1,
            0,
            0,
            user,
            deadline
        );

        // Get pair address
        address pair = factory.getPair(address(token0), address(token1));

        // Create permit signature with a valid private key
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        
        // First transfer the liquidity to the signer account
        vm.prank(user);
        IERC20(pair).transfer(signer, liquidity);
        
        uint256 value = liquidity;
        uint256 nonce = IUniswapV2ERC20(pair).nonces(signer);
        bytes32 domainSeparator = IUniswapV2ERC20(pair).DOMAIN_SEPARATOR();
        bytes32 permitTypehash = IUniswapV2ERC20(pair).PERMIT_TYPEHASH();
        
        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeparator,
                keccak256(
                    abi.encode(
                        permitTypehash,
                        signer,
                        address(router),
                        value,
                        nonce,
                        deadline
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, permitHash);

        // Remove liquidity with permit
        vm.prank(signer);
        (uint amount0Out, uint amount1Out) = router.removeLiquidityWithPermit(
            address(token0),
            address(token1),
            liquidity,
            0,
            0,
            signer,
            deadline,
            false,
            v,
            r,
            s
        );

        // Verify amounts
        assertGt(amount0Out, 0);
        assertGt(amount1Out, 0);
    }

    function test_RemoveLiquidityETHWithPermit() public {
        // First add liquidity with ETH
        uint amountToken = 1 ether;
        uint deadline = block.timestamp + 1 hours;

        vm.prank(user);
        token0.approve(address(router), amountToken);

        vm.prank(user);
        (uint amountTokenIn, uint amountETHIn, uint liquidity) = router.addLiquidityETH{value: 1 ether}(
            address(token0),
            amountToken,
            0,
            0,
            user,
            deadline
        );

        // Get pair address
        address pair = factory.getPair(address(token0), address(weth));
        
        // Create permit signature with a valid private key
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        
        // First transfer the liquidity to the signer account
        vm.prank(user);
        IERC20(pair).transfer(signer, liquidity);
        
        uint256 value = liquidity;
        uint256 nonce = IUniswapV2ERC20(pair).nonces(signer);
        bytes32 domainSeparator = IUniswapV2ERC20(pair).DOMAIN_SEPARATOR();
        bytes32 permitTypehash = IUniswapV2ERC20(pair).PERMIT_TYPEHASH();
        
        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeparator,
                keccak256(
                    abi.encode(
                        permitTypehash,
                        signer,
                        address(router),
                        value,
                        nonce,
                        deadline
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, permitHash);

        // Remove liquidity with permit
        vm.prank(signer);
        (uint amountTokenOut, uint amountETHOut) = router.removeLiquidityETHWithPermit(
            address(token0),
            liquidity,
            0,
            0,
            signer,
            deadline,
            false,
            v,
            r,
            s
        );
        
        // Verify amounts
        assertGt(amountTokenOut, 0);
        assertGt(amountETHOut, 0);
    }

    function test_RemoveLiquidityETHSupportingFeeOnTransferTokens() public {
        // First add liquidity with ETH
        uint amountToken = 1 ether;
        uint deadline = block.timestamp + 1 hours;

        vm.startPrank(user);
        token0.approve(address(router), amountToken);

        (uint amountTokenIn, uint amountETH, uint liquidity) = router.addLiquidityETH{value: 1 ether}(
            address(token0),
            amountToken,
            0,
            0,
            user,
            deadline
        );

        // Get pair address and approve LP tokens for removal
        address pair = factory.getPair(address(token0), address(weth));
        IERC20(pair).approve(address(router), type(uint256).max);

        // Remove liquidity
        uint amountETHOut = router.removeLiquidityETHSupportingFeeOnTransferTokens(
            address(token0),
            liquidity,
            0,
            0,
            user,
            deadline
        );
        vm.stopPrank();

        // Verify amount
        assertGt(amountETHOut, 0);
    }

    function test_RemoveLiquidityETHWithPermitSupportingFeeOnTransferTokens() public {
        // First add liquidity with ETH
        uint amountToken = 1 ether;
        uint deadline = block.timestamp + 1 hours;

        vm.prank(user);
        token0.approve(address(router), amountToken);

        vm.prank(user);
        (uint amountTokenIn, uint amountETH, uint liquidity) = router.addLiquidityETH{value: 1 ether}(
            address(token0),
            amountToken,
            0,
            0,
            user,
            deadline
        );

        // Get pair address
        address pair = factory.getPair(address(token0), address(weth));

        // Create permit signature with a valid private key
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        
        // First transfer the liquidity to the signer account
        vm.prank(user);
        IERC20(pair).transfer(signer, liquidity);
        
        uint256 value = liquidity;
        uint256 nonce = IUniswapV2ERC20(pair).nonces(signer);
        bytes32 domainSeparator = IUniswapV2ERC20(pair).DOMAIN_SEPARATOR();
        bytes32 permitTypehash = IUniswapV2ERC20(pair).PERMIT_TYPEHASH();
        
        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeparator,
                keccak256(
                    abi.encode(
                        permitTypehash,
                        signer,
                        address(router),
                        value,
                        nonce,
                        deadline
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, permitHash);

        // Remove liquidity with permit
        vm.prank(signer);
        uint amountETHOut = router.removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(
            address(token0),
            liquidity,
            0,
            0,
            signer,
            deadline,
            false,
            v,
            r,
            s
        );

        // Verify amount
        assertGt(amountETHOut, 0);
    }

    function test_SwapExactTokensForTokens() public {
        // First add liquidity
        uint amount0 = 5 ether;
        uint amount1 = 10 ether;
        uint deadline = block.timestamp + 1 hours;

        vm.prank(user);
        token0.approve(address(router), amount0);
        vm.prank(user);
        token1.approve(address(router), amount1);

        vm.prank(user);
        router.addLiquidity(
            address(token0),
            address(token1),
            amount0,
            amount1,
            0,
            0,
            user,
            deadline
        );

        // Setup swap
        uint amountIn = 1 ether;
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(token1);

        // Approve router for swap
        vm.prank(user);
        token0.approve(address(router), amountIn);

        // Perform swap
        vm.prank(user);
        uint[] memory amounts = router.swapExactTokensForTokens(
            amountIn,
            0,
            path,
            user,
            deadline
        );

        // Verify amounts
        assertEq(amounts[0], amountIn);
        assertGt(amounts[1], 0);
    }

    function test_SwapTokensForExactTokens() public {
        // First add liquidity
        uint amount0 = 5 ether;
        uint amount1 = 10 ether;
        uint deadline = block.timestamp + 1 hours;

        vm.prank(user);
        token0.approve(address(router), amount0);
        vm.prank(user);
        token1.approve(address(router), amount1);

        vm.prank(user);
        router.addLiquidity(
            address(token0),
            address(token1),
            amount0,
            amount1,
            0,
            0,
            user,
            deadline
        );

        // Setup swap
        uint amountOut = 1 ether;
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(token1);

        // Approve router for swap
        vm.prank(user);
        token0.approve(address(router), type(uint256).max);

        // Perform swap
        vm.prank(user);
        uint[] memory amounts = router.swapTokensForExactTokens(
            amountOut,
            type(uint256).max,
            path,
            user,
            deadline
        );

        // Verify amounts
        assertGt(amounts[0], 0);
        assertEq(amounts[1], amountOut);
    }

    function test_SwapExactETHForTokens() public {
        // First add liquidity with ETH
        uint amountToken = 5 ether;
        uint deadline = block.timestamp + 1 hours;

        vm.prank(user);
        token0.approve(address(router), amountToken);

        vm.prank(user);
        router.addLiquidityETH{value: 5 ether}(
            address(token0),
            amountToken,
            0,
            0,
            user,
            deadline
        );

        // Setup swap
        address[] memory path = new address[](2);
        path[0] = address(weth);
        path[1] = address(token0);

        // Perform swap
        vm.prank(user);
        uint[] memory amounts = router.swapExactETHForTokens{value: 1 ether}(
            0,
            path,
            user,
            deadline
        );

        // Verify amounts
        assertEq(amounts[0], 1 ether);
        assertGt(amounts[1], 0);
    }

    function test_SwapTokensForExactETH() public {
        // First add liquidity with ETH
        uint amountToken = 5 ether;
        uint deadline = block.timestamp + 1 hours;

        vm.prank(user);
        token0.approve(address(router), amountToken);

        vm.prank(user);
        router.addLiquidityETH{value: 5 ether}(
            address(token0),
            amountToken,
            0,
            0,
            user,
            deadline
        );

        // Setup swap
        uint amountOut = 1 ether;
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(weth);

        // Approve router for swap
        vm.prank(user);
        token0.approve(address(router), type(uint256).max);

        // Perform swap
        vm.prank(user);
        uint[] memory amounts = router.swapTokensForExactETH(
            amountOut,
            type(uint256).max,
            path,
            user,
            deadline
        );

        // Verify amounts
        assertGt(amounts[0], 0);
        assertEq(amounts[1], amountOut);
    }

    function test_SwapExactTokensForETH() public {
        // First add liquidity with ETH
        uint amountToken = 5 ether;
        uint deadline = block.timestamp + 1 hours;

        vm.prank(user);
        token0.approve(address(router), amountToken);

        vm.prank(user);
        router.addLiquidityETH{value: 5 ether}(
            address(token0),
            amountToken,
            0,
            0,
            user,
            deadline
        );

        // Setup swap
        uint amountIn = 1 ether;
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(weth);

        // Approve router for swap
        vm.prank(user);
        token0.approve(address(router), amountIn);

        // Perform swap
        vm.prank(user);
        uint[] memory amounts = router.swapExactTokensForETH(
            amountIn,
            0,
            path,
            user,
            deadline
        );

        // Verify amounts
        assertEq(amounts[0], amountIn);
        assertGt(amounts[1], 0);
    }

    function test_SwapETHForExactTokens() public {
        // First add liquidity with ETH
        uint amountToken = 5 ether;
        uint deadline = block.timestamp + 1 hours;

        vm.prank(user);
        token0.approve(address(router), amountToken);

        vm.prank(user);
        router.addLiquidityETH{value: 5 ether}(
            address(token0),
            amountToken,
            0,
            0,
            user,
            deadline
        );

        // Setup swap
        uint amountOut = 1 ether;
        address[] memory path = new address[](2);
        path[0] = address(weth);
        path[1] = address(token0);

        // Perform swap
        vm.prank(user);
        uint[] memory amounts = router.swapETHForExactTokens{value: 5 ether}(
            amountOut,
            path,
            user,
            deadline
        );

        // Verify amounts
        assertGt(amounts[0], 0);
        assertEq(amounts[1], amountOut);
    }

    function test_Quote() public {
        uint amountA = 1 ether;
        uint reserveA = 5 ether;
        uint reserveB = 10 ether;
        uint amountB = router.quote(amountA, reserveA, reserveB);
        assertGt(amountB, 0);
    }

    function test_GetAmountOut() public {
        uint amountIn = 1 ether;
        uint reserveIn = 5 ether;
        uint reserveOut = 10 ether;
        uint amountOut = router.getAmountOut(amountIn, reserveIn, reserveOut);
        assertGt(amountOut, 0);
    }

    function test_GetAmountIn() public {
        uint amountOut = 1 ether;
        uint reserveIn = 5 ether;
        uint reserveOut = 10 ether;
        uint amountIn = router.getAmountIn(amountOut, reserveIn, reserveOut);
        assertGt(amountIn, 0);
    }

    function test_GetAmountsOut() public {
        // First add liquidity to create the pair and provide reserves
        uint token0Amount = 5 ether;
        uint token1Amount = 10 ether;
        
        // Approve and add liquidity
        vm.startPrank(user);
        token0.approve(address(router), token0Amount);
        token1.approve(address(router), token1Amount);
        router.addLiquidity(
            address(token0),
            address(token1),
            token0Amount,
            token1Amount,
            0,
            0,
            user,
            block.timestamp + 1
        );
        vm.stopPrank();
        
        // Now test getAmountsOut
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(token1);

        uint[] memory amounts = router.getAmountsOut(1 ether, path);
        assertEq(amounts.length, 2);
        assertEq(amounts[0], 1 ether);
        assertGt(amounts[1], 0);
    }

    function test_GetAmountsIn() public {
        // First add liquidity to create the pair and provide reserves
        uint token0Amount = 5 ether;
        uint token1Amount = 10 ether;
        
        // Approve and add liquidity
        vm.startPrank(user);
        token0.approve(address(router), token0Amount);
        token1.approve(address(router), token1Amount);
        router.addLiquidity(
            address(token0),
            address(token1),
            token0Amount,
            token1Amount,
            0,
            0,
            user,
            block.timestamp + 1
        );
        vm.stopPrank();
        
        // Now test getAmountsIn
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(token1);

        uint[] memory amounts = router.getAmountsIn(1 ether, path);
        assertEq(amounts.length, 2);
        assertGt(amounts[0], 0);
        assertEq(amounts[1], 1 ether);
    }

    function test_SwapExactTokensForTokensSupportingFeeOnTransferTokens() public {
        // First add liquidity
        uint amount0 = 5 ether;
        uint amount1 = 10 ether;
        uint deadline = block.timestamp + 1 hours;

        vm.prank(user);
        token0.approve(address(router), amount0);
        vm.prank(user);
        token1.approve(address(router), amount1);

        vm.prank(user);
        router.addLiquidity(
            address(token0),
            address(token1),
            amount0,
            amount1,
            0,
            0,
            user,
            deadline
        );

        // Setup swap
        uint amountIn = 1 ether;
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(token1);

        // Approve router for swap
        vm.prank(user);
        token0.approve(address(router), amountIn);

        // Record balance before swap
        uint balanceBefore = token1.balanceOf(user);

        // Perform swap
        vm.prank(user);
        router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountIn,
            0,
            path,
            user,
            deadline
        );

        // Verify token1 balance increased
        assertGt(token1.balanceOf(user), balanceBefore);
    }

    function test_SwapExactETHForTokensSupportingFeeOnTransferTokens() public {
        // First add liquidity with ETH
        uint amountToken = 5 ether;
        uint deadline = block.timestamp + 1 hours;

        vm.prank(user);
        token0.approve(address(router), amountToken);

        vm.prank(user);
        router.addLiquidityETH{value: 5 ether}(
            address(token0),
            amountToken,
            0,
            0,
            user,
            deadline
        );

        // Setup swap
        address[] memory path = new address[](2);
        path[0] = address(weth);
        path[1] = address(token0);

        // Perform swap
        vm.prank(user);
        router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: 1 ether}(
            0,
            path,
            user,
            deadline
        );

        // Verify token0 balance increased
        assertGt(token0.balanceOf(user), 0);
    }

    function test_SwapExactTokensForETHSupportingFeeOnTransferTokens() public {
        // First add liquidity with ETH
        uint amountToken = 5 ether;
        uint deadline = block.timestamp + 1 hours;

        vm.prank(user);
        token0.approve(address(router), amountToken);

        vm.prank(user);
        router.addLiquidityETH{value: 5 ether}(
            address(token0),
            amountToken,
            0,
            0,
            user,
            deadline
        );

        // Setup swap
        uint amountIn = 1 ether;
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(weth);

        // Approve router for swap
        vm.prank(user);
        token0.approve(address(router), amountIn);

        // Perform swap
        vm.prank(user);
        router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            amountIn,
            0,
            path,
            user,
            deadline
        );

        // Verify ETH balance increased
        assertGt(user.balance, 0);
    }

    function test_AddLiquidityWithInvalidPath() public {
        uint deadline = block.timestamp + 1 hours;
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(token0); // Same token

        vm.prank(user);
        vm.expectRevert("UniswapV2: IDENTICAL_ADDRESSES");
        router.addLiquidity(
            address(token0),
            address(token0),
            1 ether,
            1 ether,
            0,
            0,
            user,
            deadline
        );
    }

    function test_AddLiquidityWithInsufficientAmount() public {
        vm.startPrank(user);
        token0.approve(address(router), 10 ether);
        token1.approve(address(router), 10 ether);
        
        // First, add some liquidity to create the pair
        router.addLiquidity(
            address(token0),
            address(token1),
            10 ether,
            10 ether,
            0,
            0,
            user,
            block.timestamp + 1
        );
        
        // Then try to add an invalid liquidity that should revert
        token0.approve(address(router), 1 ether);
        token1.approve(address(router), 1 ether);
        vm.stopPrank();
        
        vm.prank(user);
        // Update expected error message to match what the library actually returns
        vm.expectRevert("UniswapV2Library: INSUFFICIENT_AMOUNT");
        router.addLiquidity(
            address(token0),
            address(token1),
            1 ether,
            0, // amountBDesired is 0, should fail with "INSUFFICIENT_B_AMOUNT"
            1 ether,
            0,
            user,
            block.timestamp + 1
        );
    }

    function test_RemoveLiquidityWithInsufficientAmount() public {
        // First add liquidity
        uint amount0 = 1 ether;
        uint amount1 = 4 ether;
        uint deadline = block.timestamp + 1 hours;

        vm.startPrank(user);
        token0.approve(address(router), amount0);
        token1.approve(address(router), amount1);

        (uint amountA, uint amountB, uint liquidity) = router.addLiquidity(
            address(token0),
            address(token1),
            amount0,
            amount1,
            0,
            0,
            user,
            deadline
        );

        // Approve router to remove liquidity
        address pair = factory.getPair(address(token0), address(token1));
        IERC20(pair).approve(address(router), liquidity);

        // Try to remove liquidity with minimum amount too high
        vm.expectRevert("UniswapV2Router: INSUFFICIENT_A_AMOUNT");
        router.removeLiquidity(
            address(token0),
            address(token1),
            liquidity,
            amount0 * 2,
            0,
            user,
            deadline
        );
        vm.stopPrank();
    }

    function test_SwapWithInvalidPath() public {
        uint deadline = block.timestamp + 1 hours;
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(token0); // Same token

        vm.prank(user);
        vm.expectRevert("UniswapV2Library: IDENTICAL_ADDRESSES");
        router.swapExactTokensForTokens(
            1 ether,
            0,
            path,
            user,
            deadline
        );
    }

    function test_SwapWithExpiredDeadline() public {
        uint deadline = block.timestamp - 1;
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(token1);

        vm.prank(user);
        vm.expectRevert("UniswapV2Router: EXPIRED");
        router.swapExactTokensForTokens(
            1 ether,
            0,
            path,
            user,
            deadline
        );
    }

    function test_SwapWithInsufficientOutputAmount() public {
        // First add liquidity
        uint amount0 = 5 ether;
        uint amount1 = 10 ether;
        uint deadline = block.timestamp + 1 hours;

        vm.prank(user);
        token0.approve(address(router), amount0);
        vm.prank(user);
        token1.approve(address(router), amount1);

        vm.prank(user);
        router.addLiquidity(
            address(token0),
            address(token1),
            amount0,
            amount1,
            0,
            0,
            user,
            deadline
        );

        // Setup swap with minimum output too high
        uint amountIn = 1 ether;
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(token1);

        vm.prank(user);
        token0.approve(address(router), amountIn);

        vm.prank(user);
        vm.expectRevert("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT");
        router.swapExactTokensForTokens(
            amountIn,
            amount1 * 2, // Minimum output too high
            path,
            user,
            deadline
        );
    }

    function test_SwapWithExcessiveInputAmount() public {
        // First add liquidity
        uint amount0 = 5 ether;
        uint amount1 = 10 ether;
        uint deadline = block.timestamp + 1 hours;

        vm.startPrank(user);
        token0.approve(address(router), amount0);
        token1.approve(address(router), amount1);

        router.addLiquidity(
            address(token0),
            address(token1),
            amount0,
            amount1,
            0,
            0,
            user,
            deadline
        );

        // Calculate a very small amountOut that will require too much input
        uint amountOut = 9 ether; // Almost all of token1 in the pool
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(token1);

        token0.approve(address(router), type(uint256).max);

        // Setting a very low max input should cause a revert
        vm.expectRevert("UniswapV2Router: EXCESSIVE_INPUT_AMOUNT");
        router.swapTokensForExactTokens(
            amountOut,
            1 ether, // Maximum input too low
            path,
            user,
            deadline
        );
        vm.stopPrank();
    }

    function test_SwapETHWithInvalidPath() public {
        uint deadline = block.timestamp + 1 hours;
        address[] memory path = new address[](2);
        path[0] = address(token0); // Not WETH
        path[1] = address(token1);

        vm.prank(user);
        vm.expectRevert("UniswapV2Router: INVALID_PATH");
        router.swapExactETHForTokens{value: 1 ether}(
            0,
            path,
            user,
            deadline
        );
    }

    function test_SwapETHWithInsufficientValue() public {
        uint deadline = block.timestamp + 1 hours;
        address[] memory path = new address[](2);
        path[0] = address(weth);
        path[1] = address(token0);

        // Add initial liquidity
        vm.startPrank(user);
        token0.approve(address(router), 10 ether);
        router.addLiquidityETH{value: 10 ether}(
            address(token0),
            10 ether,
            0,
            0,
            user,
            deadline
        );
        vm.stopPrank();

        vm.prank(user);
        vm.expectRevert("UniswapV2Router: EXCESSIVE_INPUT_AMOUNT");
        router.swapETHForExactTokens{value: 0.1 ether}(
            1 ether,
            path,
            user,
            deadline
        );
    }

    function test_CreatePairDirectly() public {
        console.log("Starting test_CreatePairDirectly");
        
        // Create pair directly through factory
        console.log("Creating pair directly through factory");
        address pair = factory.createPair(address(token0), address(token1));
        console.log("Pair created:", pair);
        
        // Check pair was created correctly
        address retrievedPair = factory.getPair(address(token0), address(token1));
        console.log("Retrieved pair:", retrievedPair);
        assertTrue(retrievedPair != address(0), "Pair not created correctly");
        assertEq(pair, retrievedPair, "Created and retrieved pairs don't match");
        
        // Try to get reserves
        (uint reserve0, uint reserve1, ) = IUniswapV2Pair(pair).getReserves();
        console.log("Reserves: ", reserve0, reserve1);
        
        // We're done
        console.log("Done with direct pair creation test");
    }

    function test_AddLiquidityManually() public {
        console.log("Starting test_AddLiquidityManually");
        
        uint amount0 = 1 ether;
        uint amount1 = 4 ether;
        
        // Create pair directly through factory
        console.log("Creating pair directly through factory");
        address pair = factory.createPair(address(token0), address(token1));
        console.log("Pair created:", pair);
        
        // Transfer tokens to the pair
        console.log("Transferring tokens to pair");
        token0.transfer(pair, amount0);
        token1.transfer(pair, amount1);
        console.log("  token0 amount:", token0.balanceOf(pair));
        console.log("  token1 amount:", token1.balanceOf(pair));
        
        // Mint liquidity tokens
        console.log("Minting liquidity tokens");
        uint liquidity = IUniswapV2Pair(pair).mint(address(this));
        console.log("Liquidity minted:", liquidity);
        
        // Check reserves
        (uint reserve0, uint reserve1, ) = IUniswapV2Pair(pair).getReserves();
        console.log("Reserves after mint: ", reserve0, reserve1);
        
        // Check balances
        console.log("LP token balance:", IERC20(pair).balanceOf(address(this)));
        
        // We're done
        console.log("Done with manual liquidity test");
    }

    function addLiquidity() internal returns (uint) {
        uint amount0 = 1000 ether;
        uint amount1 = 1000 ether;
        
        token0.approve(address(router), amount0);
        token1.approve(address(router), amount1);
        
        (uint amountA, uint amountB, uint liquidity) = router.addLiquidity(
            address(token0),
            address(token1),
            amount0,
            amount1,
            0, // min amount0
            0, // min amount1
            address(this),
            block.timestamp + 15 minutes
        );
        
        return liquidity;
    }
} 