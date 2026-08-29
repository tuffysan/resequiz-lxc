#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
ROOT="$(cd "$ROOT" && pwd)"
cd "$ROOT/app"
node --check server.js
for f in public/js/*.js; do node --check "$f"; done
bash "$ROOT/scripts/release-regression-check.sh" "$ROOT"
node --test tests/*.test.js
node - <<'NODE'
const {DatabaseSync}=require('node:sqlite'); const {migrate}=require('./database'); const db=new DatabaseSync(':memory:');migrate(db);const v=db.prepare('select version from schema_info').get().version;if(v!==2400)throw new Error('schema != 2400');console.log('Release DB gate OK – schema',v);db.close();
NODE
echo 'Release gate OK – syntax, regression, migration and tests passed'
