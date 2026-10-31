#!/usr/bin/env python3
"""Build-time gettext tooling. Requires Python 3 and Babel, never used by Shell."""
import argparse
import json
from pathlib import Path
import xml.etree.ElementTree as ET

from babel.messages.catalog import Catalog
from babel.messages.extract import extract
from babel.messages.mofile import write_mo
from babel.messages.pofile import read_po, write_po

ROOT = Path(__file__).resolve().parent.parent
METADATA = json.loads((ROOT / 'metadata.json').read_text())
DOMAIN = METADATA['gettext-domain']
POT = ROOT / 'po' / f'{DOMAIN}.pot'


def template():
    catalog = Catalog(project='Cliplet', version='1', copyright_holder='Markus Högberg',
                      msgid_bugs_address=METADATA['url'] + '/issues')
    catalog.header_comment = '# Gettext template for Cliplet.\n# Copyright (C) 2026 Markus Högberg\n# Distributed under the MIT license, like Cliplet.'
    for name in ('extension.js', 'prefs.js'):
        with (ROOT / name).open('rb') as source:
            for line, message, comments, context in extract('javascript', source, keywords={'_': None}):
                catalog.add(message, locations=[(name, line)], auto_comments=comments, context=context)
    # Metadata and schema descriptions are English in the source files. Include
    # them for translation-aware consumers as well as the runtime UI messages.
    catalog.add(METADATA['description'], locations=[('metadata.json', 0)])
    schema = 'schemas/org.gnome.shell.extensions.cliplet.gschema.xml'
    for node in ET.parse(ROOT / schema).iter():
        if node.tag in ('summary', 'description'):
            catalog.add(node.text, locations=[(schema, 0)])
    return catalog


def build():
    expected = {m.id for m in template() if m.id}
    for path in sorted((ROOT / 'po').glob('*.po')):
        with path.open('rb') as source:
            catalog = read_po(source, locale=path.stem, abort_invalid=True)
        if catalog.fuzzy:
            raise ValueError(f'{path.name}: fuzzy catalog header')
        actual = {m.id for m in catalog if m.id}
        if actual != expected:
            raise ValueError(f'{path.name}: catalog is out of date; update the POT and PO files')
        for message in catalog:
            if message.id and (message.fuzzy or not message.string or message.check(catalog)):
                raise ValueError(f'{path.name}: incomplete or invalid translation: {message.id}')
        target = ROOT / 'locale' / path.stem / 'LC_MESSAGES' / f'{DOMAIN}.mo'
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('wb') as output:
            write_mo(output, catalog, use_fuzzy=False)
        print(f'Built {target.relative_to(ROOT)} ({len(actual)} messages)')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['pot', 'build'])
    args = parser.parse_args()
    if args.command == 'pot':
        with POT.open('wb') as output:
            write_po(output, template(), width=88, sort_output=True)
        print(f'Updated {POT.relative_to(ROOT)}')
    else:
        build()


if __name__ == '__main__':
    main()
