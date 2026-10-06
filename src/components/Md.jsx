/* 아주 작은 마크다운 표시기 (라이브러리 없이). 플랜 템플릿의 개요·자료실용.
   지원: ### 소제목, | 표 |, 빈 줄로 나뉜 문단, 줄바꿈, http 링크. 그 외 문법은 글자 그대로. */

const linkify = (text, key) => text.split(/(https?:\/\/\S+)/g).map((part, i) =>
  /^https?:\/\//.test(part) ? <a key={key + '-' + i} href={part} target="_blank" rel="noreferrer">{part}</a> : part)

export default function Md({ text }) {
  const blocks = String(text || '').trim().split(/\n\s*\n/)
  return (
    <div className="md">
      {blocks.map((b, i) => {
        const lines = b.split('\n')
        if (lines.every(l => l.trim().startsWith('|'))) {
          const rows = lines.filter(l => !/^\|\s*-/.test(l.trim())).map(l => l.trim().split('|').slice(1, -1).map(c => c.trim()))
          return (
            <table key={i} className="md-table">
              <thead><tr>{rows[0].map((c, j) => <th key={j}>{c}</th>)}</tr></thead>
              <tbody>{rows.slice(1).map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          )
        }
        return lines.map((l, j) => /^#{2,4} /.test(l)
          ? <h4 key={i + '-' + j} className="md-h">{l.replace(/^#+ /, '')}</h4>
          : <p key={i + '-' + j} className="md-p">{linkify(l, i + '-' + j)}</p>)
      })}
    </div>
  )
}
