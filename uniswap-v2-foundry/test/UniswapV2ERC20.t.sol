// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "forge-std/Test.sol";
import "../src/core/UniswapV2ERC20.sol";

// Test-specific ERC20 contract that exposes mint and burn
contract TestERC20 is UniswapV2ERC20 {
    function mint(address to, uint256 value) public {
        _mint(to, value);
    }

    function burn(address from, uint256 value) public {
        _burn(from, value);
    }
}

contract UniswapV2ERC20Test is Test {
    TestERC20 token;
    address owner;
    address spender;
    address recipient;
    uint256 constant INITIAL_SUPPLY = 1000000 ether;
    uint256 constant TEST_AMOUNT = 100 ether;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function setUp() public {
        owner = address(this);
        spender = address(0xdead);
        recipient = address(0xbeef);
        token = new TestERC20();
    }

    // Basic ERC20 Properties Tests
    function test_Name() public {
        assertEq(token.name(), "Uniswap V2");
    }

    function test_Symbol() public {
        assertEq(token.symbol(), "UNI-V2");
    }

    function test_Decimals() public {
        assertEq(token.decimals(), 18);
    }

    function test_TotalSupply() public {
        assertEq(token.totalSupply(), 0);
        token.mint(owner, INITIAL_SUPPLY);
        assertEq(token.totalSupply(), INITIAL_SUPPLY);
    }

    // Mint and Burn Tests
    function test_Mint() public {
        vm.expectEmit(true, true, false, true);
        emit Transfer(address(0), owner, TEST_AMOUNT);
        token.mint(owner, TEST_AMOUNT);
        assertEq(token.balanceOf(owner), TEST_AMOUNT);
        assertEq(token.totalSupply(), TEST_AMOUNT);
    }

    function test_Burn() public {
        token.mint(owner, TEST_AMOUNT);
        vm.expectEmit(true, true, false, true);
        emit Transfer(owner, address(0), TEST_AMOUNT);
        token.burn(owner, TEST_AMOUNT);
        assertEq(token.balanceOf(owner), 0);
        assertEq(token.totalSupply(), 0);
    }

    function test_BurnFailsForInsufficientBalance() public {
        token.mint(owner, TEST_AMOUNT);
        vm.expectRevert("UniswapV2: INSUFFICIENT_BALANCE");
        token.burn(owner, TEST_AMOUNT + 1);
    }

    // Transfer Tests
    function test_Transfer() public {
        token.mint(owner, TEST_AMOUNT);
        vm.expectEmit(true, true, false, true);
        emit Transfer(owner, recipient, TEST_AMOUNT);
        bool success = token.transfer(recipient, TEST_AMOUNT);
        assertTrue(success);
        assertEq(token.balanceOf(owner), 0);
        assertEq(token.balanceOf(recipient), TEST_AMOUNT);
    }

    function test_TransferFailsForInsufficientBalance() public {
        token.mint(owner, TEST_AMOUNT);
        vm.expectRevert("UniswapV2: INSUFFICIENT_BALANCE");
        token.transfer(recipient, TEST_AMOUNT + 1);
    }

    // Approval Tests
    function test_Approve() public {
        vm.expectEmit(true, true, false, true);
        emit Approval(owner, spender, TEST_AMOUNT);
        bool success = token.approve(spender, TEST_AMOUNT);
        assertTrue(success);
        assertEq(token.allowance(owner, spender), TEST_AMOUNT);
    }

    // TransferFrom Tests
    function test_TransferFrom() public {
        token.mint(owner, TEST_AMOUNT);
        token.approve(spender, TEST_AMOUNT);
        vm.prank(spender);
        vm.expectEmit(true, true, false, true);
        emit Transfer(owner, recipient, TEST_AMOUNT);
        bool success = token.transferFrom(owner, recipient, TEST_AMOUNT);
        assertTrue(success);
        assertEq(token.balanceOf(owner), 0);
        assertEq(token.balanceOf(recipient), TEST_AMOUNT);
        assertEq(token.allowance(owner, spender), 0);
    }

    function test_TransferFromWithUnlimitedAllowance() public {
        token.mint(owner, TEST_AMOUNT);
        token.approve(spender, type(uint256).max);
        vm.prank(spender);
        bool success = token.transferFrom(owner, recipient, TEST_AMOUNT);
        assertTrue(success);
        assertEq(token.balanceOf(owner), 0);
        assertEq(token.balanceOf(recipient), TEST_AMOUNT);
        assertEq(token.allowance(owner, spender), type(uint256).max);
    }

    function test_TransferFromFailsForInsufficientAllowance() public {
        token.mint(owner, TEST_AMOUNT);
        token.approve(spender, TEST_AMOUNT - 1);
        vm.prank(spender);
        vm.expectRevert("UniswapV2: INSUFFICIENT_ALLOWANCE");
        token.transferFrom(owner, recipient, TEST_AMOUNT);
    }

    function test_TransferFromFailsForInsufficientBalance() public {
        token.mint(owner, TEST_AMOUNT);
        token.approve(spender, TEST_AMOUNT + 1);
        vm.prank(spender);
        vm.expectRevert("UniswapV2: INSUFFICIENT_BALANCE");
        token.transferFrom(owner, recipient, TEST_AMOUNT + 1);
    }

    // Permit Tests
    function test_Permit() public {
        uint256 deadline = block.timestamp + 1 days;
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                token.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        signer,
                        spender,
                        TEST_AMOUNT,
                        token.nonces(signer),
                        deadline
                    )
                )
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        token.permit(signer, spender, TEST_AMOUNT, deadline, v, r, s);
        assertEq(token.allowance(signer, spender), TEST_AMOUNT);
        assertEq(token.nonces(signer), 1);
    }

    function test_PermitFailsForExpiredDeadline() public {
        uint256 deadline = block.timestamp - 1;
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                token.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        signer,
                        spender,
                        TEST_AMOUNT,
                        token.nonces(signer),
                        deadline
                    )
                )
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        vm.expectRevert("UniswapV2: EXPIRED");
        token.permit(signer, spender, TEST_AMOUNT, deadline, v, r, s);
    }

    function test_PermitFailsForInvalidSignature() public {
        uint256 deadline = block.timestamp + 1 days;
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                token.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        signer,
                        spender,
                        TEST_AMOUNT,
                        token.nonces(signer),
                        deadline
                    )
                )
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        s = bytes32(uint256(s) + 1); // Modify signature
        vm.expectRevert("UniswapV2: INVALID_SIGNATURE");
        token.permit(signer, spender, TEST_AMOUNT, deadline, v, r, s);
    }

    function test_PermitFailsForReplay() public {
        uint256 deadline = block.timestamp + 1 days;
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                token.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        signer,
                        spender,
                        TEST_AMOUNT,
                        token.nonces(signer),
                        deadline
                    )
                )
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        token.permit(signer, spender, TEST_AMOUNT, deadline, v, r, s);
        vm.expectRevert("UniswapV2: INVALID_SIGNATURE");
        token.permit(signer, spender, TEST_AMOUNT, deadline, v, r, s);
    }
} 