cmake_minimum_required(VERSION 3.28)
project(voice.hypha.tests)
find_package(eosio.cdt)

add_native_executable(decay_test decay_test.cpp ${CMAKE_SOURCE_DIR}/../src/decay.cpp)
target_include_directories( decay_test PUBLIC ${CMAKE_SOURCE_DIR}/../include )

