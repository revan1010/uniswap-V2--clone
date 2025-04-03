#!/bin/bash

# Load environment variables
source .env

# Check if private key is set
if [ "$PRIVATE_KEY" = "your_private_key_here" ]; then
  echo "Error: Please set your private key in the .env file"
  exit 1
fi

# Get the sender address from the private key
SENDER_ADDRESS=$(cast wallet address --private-key $PRIVATE_KEY)
echo "Using sender address: $SENDER_ADDRESS"

# Deploy contracts to Tenderly fork
echo "Deploying contracts to Tenderly fork..."
forge script script/DeployTenderly.s.sol:DeployTenderly \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --sender $SENDER_ADDRESS \
  --broadcast \
  -vvvv

# Check if deployment was successful
if [ $? -eq 0 ]; then
  echo "Deployment successful!"
  echo "Please update the FACTORY_ADDRESS and ROUTER_ADDRESS in your frontend code."
else
  echo "Deployment failed. Please check the error messages above."
fi 