#!/bin/bash
if [[ "$#" -gt 0 ]]; then
  printf -v VERSION '%q ' "$@"
else
  VERSION=""
fi
vsce package --no-dependencies -o bin/ 
