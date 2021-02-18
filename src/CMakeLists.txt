project(voice-hypha-build)
set(EOSIO_WASM_OLD_BEHAVIOR "Off")
find_package(eosio.cdt)

include(CMakeLists-ExternalProjects.txt)

add_contract( voice.hypha voice
        voice.cpp
        decay.cpp
        ${DOCUMENT_GRAPH_SOURCE}/document_graph/edge.cpp
        ${DOCUMENT_GRAPH_SOURCE}/document_graph/document.cpp
        ${DOCUMENT_GRAPH_SOURCE}/document_graph/content.cpp
        ${DOCUMENT_GRAPH_SOURCE}/document_graph/content_wrapper.cpp
        ${DOCUMENT_GRAPH_SOURCE}/document_graph/util.cpp
)

target_include_directories( voice PUBLIC ${CMAKE_SOURCE_DIR}/../include )
# target_ricardian_directory( voice ${CMAKE_SOURCE_DIR}/../ricardian )
