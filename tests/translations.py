#!/usr/bin/env python3
"""Catalog coverage, real GJS/gettext locale lookup and controller regression tests."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
from translations import ROOT, DOMAIN, POT, template
from babel.messages.pofile import read_po

with (ROOT / 'po/sv.po').open('rb') as source:
    sv = read_po(source, locale='sv', abort_invalid=True)
with POT.open('rb') as source:
    pot = read_po(source, abort_invalid=True)
expected = {m.id for m in template() if m.id}
assert expected == {m.id for m in pot if m.id} == {m.id for m in sv if m.id}
assert not sv.fuzzy
assert all(m.string and not m.fuzzy and not m.check(sv) for m in sv if m.id)
for name, module in [('extension.js', '/org/gnome/shell/extensions/extension.js'),
                     ('prefs.js', '/org/gnome/Shell/Extensions/js/extensions/prefs.js')]:
    source = (ROOT / name).read_text()
    assert 'gettext as _' in source and module in source

locales = subprocess.check_output(['locale', '-a'], text=True).splitlines()
swedish = next((loc for loc in locales if loc.lower().replace('-', '').startswith('sv_se.utf8')), None)
assert swedish, 'A Swedish UTF-8 locale is required to run translation tests'
(ROOT / '.test-output').mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(dir=ROOT / '.test-output', prefix='locale-') as tmp:
    fixture = Path(tmp) / 'messages.json'
    fixture.write_text(json.dumps({'domain': DOMAIN, 'messages': [(m.id, m.string) for m in sv if m.id]}))
    for locale, language, expected_language in [('C', '', 'en'),
                                               (swedish, 'sv', 'sv'),
                                               (swedish, 'de', 'en')]:
        env = dict(os.environ, LC_ALL=locale, LANG=locale, LANGUAGE=language)
        subprocess.run(['gjs', '-m', 'tests/locale.js', str(fixture), expected_language],
                       env=env, cwd=ROOT, check=True)
        subprocess.run(['gjs', '-m', 'tests/validate.js'], env=env, cwd=ROOT, check=True)
    env = dict(os.environ, LC_ALL=swedish, LANG=swedish, LANGUAGE='sv')
    subprocess.run(['gjs', '-m', 'tests/locale.js', str(fixture), 'en', 'missing'],
                   env=env, cwd=ROOT, check=True)
print('OK: POT/PO coverage, official gettext imports, English/Swedish/unsupported locale and controller tests')
