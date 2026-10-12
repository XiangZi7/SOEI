import { DOMParser, XMLSerializer } from '@xmldom/xmldom'

// AMLL requires Apple line keys; standard TTML often has only xml:id or no identifier.
const TTML_NS = 'http://www.w3.org/ns/ttml'
const ITUNES_NS = 'http://music.apple.com/lyric-ttml-internal'
const XML_NS = 'http://www.w3.org/XML/1998/namespace'

export function normalizeTtml(content: string): string {
  const document = new DOMParser({
    onError: (level, message) => {
      if (level === 'error' || level === 'fatalError')
        throw new Error(`TTML XML 无效：${message}`)
    },
  }).parseFromString(content, 'application/xml')
  if (!document.documentElement || document.documentElement.localName !== 'tt')
    throw new Error('未找到 TTML 根节点')
  // Normalize namespaced TTML element names for AMLL's non-namespace head/body lookup.
  for (const element of Array.from(
    document.getElementsByTagNameNS(TTML_NS, '*')
  )) {
    if (element.tagName === element.localName) continue
    const normalized = document.createElementNS(TTML_NS, element.localName!)
    for (const attribute of Array.from(element.attributes))
      normalized.setAttributeNS(
        attribute.namespaceURI,
        attribute.name,
        attribute.value
      )
    while (element.firstChild) normalized.appendChild(element.firstChild)
    element.parentNode?.replaceChild(normalized, element)
  }
  const root = document.documentElement
  root.setAttribute('xmlns', TTML_NS)
  root.setAttribute('xmlns:soei', ITUNES_NS)
  const lines = Array.from(document.getElementsByTagName('p'))
  const ids = new Set(
    lines.map(line => line.getAttributeNS(ITUNES_NS, 'key')).filter(Boolean)
  )
  lines.forEach((line, index) => {
    if (line.getAttributeNS(ITUNES_NS, 'key')) return
    let id = line.getAttributeNS(XML_NS, 'id') || `soei-${index}`
    while (ids.has(id)) id += '-'
    ids.add(id)
    line.setAttributeNS(ITUNES_NS, 'soei:key', id)
  })
  return new XMLSerializer().serializeToString(document)
}
