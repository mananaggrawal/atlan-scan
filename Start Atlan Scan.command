#!/usr/bin/env bash
# Double-click this file in Finder to start Atlan Scan and open it in your browser.
cd "$(dirname "$0")"
( sleep 3; open http://localhost:8787 ) &
./run.sh
