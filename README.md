# Voice token Project ![Status](https://github.com/hypha-dao/voice-token/actions/workflows/build.yml/badge.svg?branch=master) 

 - How to Build -
   - cd to 'build' directory
   - run the command 'cmake ..'
   - run the command 'make'.
   
 - How to run tests
   - After build: Run the command 'ctest --output-on-failure'

 - After build -
   - The built smart contract is under the 'voice' directory in the 'build' directory
   - You can then do a 'set contract' action with 'cleos' and point in to the './build/voice' directory

 - Additions to CMake should be done to the CMakeLists.txt in the './src' directory and not in the top level CMakeLists.txt
