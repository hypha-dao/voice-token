set(EOSIO_WASM_OLD_BEHAVIOR "Off")
find_package(eosio.cdt)

add_contract( voice.hypha voice
        voice.cpp
        decay.cpp
)
target_include_directories( voice PUBLIC ${CMAKE_SOURCE_DIR}/../include )
# target_ricardian_directory( voice ${CMAKE_SOURCE_DIR}/../ricardian )
