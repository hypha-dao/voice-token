project(voice-hypha-build)
set(EOSIO_WASM_OLD_BEHAVIOR "Off")
find_package(eosio.cdt)

include(CMakeLists-ExternalProjects.txt)

add_contract( voice.hypha voice
        voice.cpp
        decay.cpp
        ${CMAKE_BINARY_DIR}/docgraph/docs/docs.wasm
)

target_include_directories( voice PUBLIC ${CMAKE_SOURCE_DIR}/../include )
# target_ricardian_directory( voice ${CMAKE_SOURCE_DIR}/../ricardian )
