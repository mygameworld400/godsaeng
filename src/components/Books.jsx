import { useEffect, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { today } from '../lib/date'
import { makeCover } from '../lib/cutout'
import { ConfirmX, Help, formVals } from './common'

/* 독서(page_kind 'reading')·영화·드라마('media') 활동 페이지의 아래쪽: 보고 싶은 목록 + 컬렉션. 글자만 WORDS 로 다르다.
   - 위시북: 읽고 싶은 책 목록 (투두와 같은 구조, catDetails[catId].wish). '다 읽었어요'를 누르면 북 컬렉션으로 옮긴다.
   - 북 컬렉션: 읽은 책을 표지로 모은다 (gs_books). 표지 사진을 올리거나, 제목만 넣으면 관리자가 표지를 넣어 준다. */

const rid = () => Math.random().toString(36).slice(2, 9)

// 독서와 영화·드라마는 같은 구조, 글자만 다르다
const WORDS = {
  reading: { wish: '위시북', wishHelp: '읽고 싶은 책 목록이에요. 다 읽으면 📚 를 눌러 북 컬렉션으로 옮겨요.', wishEx: '예: 불편한 편의점', done: '📚 다 읽었어요',
    coll: '북 컬렉션', collHelp: '다 읽은 책을 표지로 모아요. 표지 사진을 올리거나, 제목만 넣어 두면 관리자가 표지를 넣어 줘요.', add: '+ 책 추가',
    item: '책', cover: '표지', author: '저자 (선택)', when: '다 읽은 날', empty: '아직 담은 책이 없어요.', wishEmpty: '읽고 싶은 책을 적어 보세요.', unit: '권' },
  media: { wish: '보고 싶은 영화·드라마', wishHelp: '보고 싶은 작품 목록이에요. 다 보면 🎬 를 눌러 컬렉션으로 옮겨요.', wishEx: '예: 오징어 게임', done: '🎬 다 봤어요',
    coll: '영화·드라마 컬렉션', collHelp: '다 본 작품을 포스터로 모아요. 포스터 사진을 올리거나, 제목만 넣어 두면 관리자가 포스터를 넣어 줘요.', add: '+ 작품 추가',
    item: '작품', cover: '포스터', author: '감독·출연 (선택)', when: '다 본 날', empty: '아직 담은 작품이 없어요.', wishEmpty: '보고 싶은 작품을 적어 보세요.', unit: '편' },
}

function CoverPick({ value, onChange, word = '표지' }) {
  const pick = async f => { try { onChange(await makeCover(f)) } catch (e) { alert(e.message) } }
  return (
    <label className="btn sm">{value ? `${word} 바꾸기` : `${word} 사진 올리기`}
      <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pick(f) }} />
    </label>
  )
}

export default function Books({ cat, kind = 'reading' }) {
  const W = WORDS[kind] || WORDS.reading
  const { S, act } = useStore()
  const [adding, setAdding] = useState(false)
  const [cover, setCover] = useState('')
  const [open, setOpen] = useState(null)    // 자세히 보는 책
  const [editWish, setEditWish] = useState(null)
  useEffect(() => { act.loadBooks(cat.id) }, [cat.id, act])

  const d = act.catDetail(cat.id), wish = d.wish || []
  const setWish = w => act.setCatDetail(cat.id, { wish: w })
  const list = S.books[cat.id] || []
  const book = list.find(b => b.id === open)

  const addWish = e => { const v = formVals(e); if (v.text) { setWish([...wish, { id: rid(), text: v.text, done: false }]); e.currentTarget.reset() } }
  const toCollection = w => { act.addBook(cat.id, { title: w.text, author: '', cover: '', readAt: today() }); setWish(wish.filter(x => x.id !== w.id)) }
  const addBook = e => {
    const v = formVals(e); if (!v.title) return
    act.addBook(cat.id, { title: v.title, author: v.author, cover, readAt: v.readAt || today() })
    e.currentTarget.reset(); setCover(''); setAdding(false)
  }

  return <>
    <section className="sheet">
      <div className="row between"><h2><span>{W.wish}</span><Help>{W.wishHelp}</Help></h2>
        <span className="pill"><b>{wish.length}</b>{W.unit}</span></div>
      {wish.length ? wish.map(w => editWish === w.id ? (
        <form key={w.id} className="addf" onSubmit={e => { const v = formVals(e); if (v.text) setWish(wish.map(x => x.id === w.id ? { ...x, text: v.text } : x)); setEditWish(null) }}>
          <input className="inp" name="text" defaultValue={w.text} maxLength={80} autoFocus aria-label="제목 수정" />
          <button className="btn pri sm">저장</button><button type="button" className="btn sm" onClick={() => setEditWish(null)}>취소</button>
        </form>
      ) : (
        <div key={w.id} className={'item' + (w.done ? ' done' : '')}>
          <label><input type="checkbox" checked={w.done} onChange={() => setWish(wish.map(x => x.id === w.id ? { ...x, done: !x.done } : x))} /><span className="t">{w.text}</span></label>
          <button className="btn sm" title={`${W.coll}으로 옮기기`} onClick={() => toCollection(w)}>{W.done}</button>
          <button className="x" aria-label="수정" onClick={() => setEditWish(w.id)}>✎</button>
          <button className="x" aria-label="삭제" onClick={() => setWish(wish.filter(x => x.id !== w.id))}>✕</button>
        </div>
      )) : <p className="empty">{W.wishEmpty}</p>}
      <form className="addf" onSubmit={addWish}>
        <input className="inp" name="text" maxLength={80} placeholder={W.wishEx} aria-label={W.wish} />
        <button className="btn pri">추가</button>
      </form>
    </section>

    <section className="sheet">
      <div className="row between">
        <h2><span>{W.coll}</span><Help>{W.collHelp}</Help></h2>
        <button className={'btn sm' + (adding ? ' hl' : '')} onClick={() => setAdding(!adding)}>{adding ? '닫기' : W.add}</button>
      </div>
      {S.booksError && <p className="note">{W.coll} 저장 준비 중이에요.</p>}
      {adding && (
        <form className="book-add" onSubmit={addBook}>
          <div className="book-cover small">{cover ? <img src={cover} alt="" /> : <span>{W.cover}</span>}</div>
          <div className="addf col" style={{ flex: 1 }}>
            <input className="inp" name="title" maxLength={80} placeholder={W.item + ' 제목'} aria-label="제목" required />
            <input className="inp" name="author" maxLength={60} placeholder={W.author} aria-label={W.author} />
            <label className="sub">{W.when} <input className="inp" name="readAt" type="date" defaultValue={today()} style={{ width: 'auto' }} /></label>
            <div className="row"><CoverPick value={cover} onChange={setCover} word={W.cover} />{cover && <button type="button" className="x" onClick={() => setCover('')}>{W.cover} 빼기</button>}
              <button className="btn pri sm">컬렉션에 담기</button></div>
            {!cover && <p className="sub">{W.cover} 없이 담으면 '{W.cover} 요청 중'으로 보이고, 관리자가 넣어 줘요.</p>}
          </div>
        </form>
      )}
      {list.length ? (
        <div className="shelf">
          {list.map(b => (
            <button key={b.id} className="book" onClick={() => setOpen(b.id)} title={b.title}>
              <span className="book-cover">{b.cover ? <img src={b.cover} alt={b.title} /> : <span className="book-noc"><b>{b.title}</b><small>{W.cover} 요청 중</small></span>}</span>
            </button>
          ))}
        </div>
      ) : <p className="empty">{W.empty}</p>}
      {book && (
        <div className="book-detail">
          <div className="book-cover small">{book.cover ? <img src={book.cover} alt="" /> : <span className="book-noc"><b>{book.title}</b></span>}</div>
          <form className="addf col" style={{ flex: 1 }} onSubmit={e => { const v = formVals(e); if (v.title) act.updateBook(cat.id, book.id, { title: v.title, author: v.author, readAt: v.readAt || null }); setOpen(null) }}>
            <input className="inp" name="title" defaultValue={book.title} maxLength={80} aria-label="제목" key={'t' + book.id} />
            <input className="inp" name="author" defaultValue={book.author} maxLength={60} placeholder={W.author} aria-label={W.author} key={'a' + book.id} />
            <label className="sub">{W.when} <input className="inp" name="readAt" type="date" defaultValue={book.readAt || ''} style={{ width: 'auto' }} key={'r' + book.id} /></label>
            <div className="row">
              <CoverPick value={book.cover} word={W.cover} onChange={c => act.updateBook(cat.id, book.id, { cover: c })} />
              <button className="btn pri sm">저장</button>
              <button type="button" className="btn sm" onClick={() => setOpen(null)}>닫기</button>
              <ConfirmX onConfirm={() => { act.delBook(cat.id, book.id); setOpen(null) }} label="빼기" className="btn sm warn" />
            </div>
          </form>
        </div>
      )}
    </section>
  </>
}
