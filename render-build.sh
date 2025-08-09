#!/bin/bash
rm -rf node_modules package-lock.json
npm install --force
npm install connect-redis@latest redis@latest