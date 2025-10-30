const removeTags = (html: string, tagNames: string[]): string => {
  return tagNames.reduce((acc, tag) => {
    const pattern = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi')
    return acc.replace(pattern, ' ')
  }, html)
}

const removeHtmlComments = (html: string): string => {
  return html.replace(/<!--([\s\S]*?)-->/g, ' ')
}

const stripBase64DataUris = (html: string): string => {
  return html.replace(/data:[^;]+;base64,[A-Za-z0-9+/=]+/gi, ' ').replace(/[A-Za-z0-9+/=]{120,}/g, ' ')
}

const stripRemainingTags = (html: string): string => {
  return html.replace(/<[^>]+>/g, ' ')
}

const normalizeWhitespace = (text: string): string => {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Removes obvious noise (scripts, styles, base64 blobs) and flattens to plain text
 * so the prompt we send to the model focuses on visible content.
 */
export const cleanPageBody = (html: string): string => {
  const withoutNoisyTags = removeTags(html, ['script', 'style', 'noscript', 'template'])
  const withoutComments = removeHtmlComments(withoutNoisyTags)
  const withoutBase64 = stripBase64DataUris(withoutComments)
  const textOnly = stripRemainingTags(withoutBase64)
  return normalizeWhitespace(textOnly)
}
