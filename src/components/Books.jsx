import { useEffect, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { today } from '../lib/date'
import { makeCover } from '../lib/cutout'
import { ConfirmX, Help, formVals } from './common'

/* 독서 활동 페이지(추천 활동 page_kind = 'reading')의 아래쪽: 위시북 + 북 컬렉션.
   - 위시북: 읽고 싶은 책 목록 (투두와 같은 구조, catDetails[catId].wish). '다 읽었어요'를 누르면 북 컬렉션으로 옮긴다.
   - 북 컬렉션: 읽은 책을 표지로 모은다 (gs_books). 표지 사진을 올리거나, 제목만 넣으면 관리자가 표지를 넣어 준다. */

const rid = () => Math.random().toString(36).slice(2, 9)

function CoverPick({ value, onChange }) {
  const pick = async f => { try { onChange(await makeCover(f)) } catch (e) { alert(e.message) } }
  return (
    <label className="btn sm">{value ? '표지 바꾸기' : '표지 사진 올리기'}
      <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pick(f) }} />
    </label>
  )
}

export default function Books({ cat }) {
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
      <div className="row between"><h2><span>위시북</span><Help>읽고 싶은 책 목록이에요. 다 읽으면 📚 를 눌러 북 컬렉션으로 옮겨요.</Help></h2>
        <span className="pill"><b>{wish.length}</b>권</span></div>
      {wish.length ? wish.map(w => editWish === w.id ? (
        <form key={w.id} className="addf" onSubmit={e => { const v = formVals(e); if (v.text) setWish(wish.map(x => x.id === w.id ? { ...x, text: v.text } : x)); setEditWish(null) }}>
          <input className="inp" name="text" defaultValue={w.text} maxLength={80} autoFocus aria-label="책 제목 수정" />
          <button className="btn pri sm">저장</button><button type="button" className="btn sm" onClick={() => setEditWish(null)}>취소</button>
        </form>
      ) : (
        <div key={w.id} className={'item' + (w.done ? ' done' : '')}>
          <label><input type="checkbox" checked={w.done} onChange={() => setWish(wish.map(x => x.id === w.id ? { ...x, done: !x.done } : x))} /><span className="t">{w.text}</span></label>
          <button className="btn sm" title="다 읽었어요 → 북 컬렉션으로" onClick={() => toCollection(w)}>📚 다 읽었어요</button>
          <button className="x" aria-label="수정" onClick={() => setEditWish(w.id)}>✎</button>
          <button className="x" aria-label="삭제" onClick={() => setWish(wish.filter(x => x.id !== w.id))}>✕</button>
        </div>
      )) : <p className="empty">읽고 싶은 책을 적어 보세요.</p>}
      <form className="addf" onSubmit={addWish}>
        <input className="inp" name="text" maxLength={80} placeholder="예: 불편한 편의점" aria-label="읽고 싶은 책" />
        <button className="btn pri">추가</button>
      </form>
    </section>

    <section className="sheet">
      <div className="row between">
        <h2><span>북 컬렉션</span><Help>다 읽은 책을 표지로 모아요. 표지 사진을 올리거나, 제목만 넣어 두면 관리자가 표지를 넣어 줘요.</Help></h2>
        <button className={'btn sm' + (adding ? ' hl' : '')} onClick={() => setAdding(!adding)}>{adding ? '닫기' : '+ 책 추가'}</button>
      </div>
      {S.booksError && <p className="note">북 컬렉션 저장 준비 중이에요.</p>}
      {adding && (
        <form className="book-add" onSubmit={addBook}>
          <div className="book-cover small">{cover ? <img src={cover} alt="" /> : <span>표지</span>}</div>
          <div className="addf col" style={{ flex: 1 }}>
            <input className="inp" name="title" maxLength={80} placeholder="책 제목" aria-label="책 제목" required />
            <input className="inp" name="author" maxLength={60} placeholder="저자 (선택)" aria-label="저자" />
            <label className="sub">다 읽은 날 <input className="inp" name="readAt" type="date" defaultValue={today()} style={{ width: 'auto' }} /></label>
            <div className="row"><CoverPick value={cover} onChange={setCover} />{cover && <button type="button" className="x" onClick={() => setCover('')}>표지 빼기</button>}
              <button className="btn pri sm">컬렉션에 담기</button></div>
            {!cover && <p className="sub">표지 없이 담으면 '표지 요청 중'으로 보이고, 관리자가 표지를 넣어 줘요.</p>}
          </div>
        </form>
      )}
      {list.length ? (
        <div className="shelf">
          {list.map(b => (
            <button key={b.id} className="book" onClick={() => setOpen(b.id)} title={b.title}>
              <span className="book-cover">{b.cover ? <img src={b.cover} alt={b.title} /> : <span className="book-noc"><b>{b.title}</b><small>표지 요청 중</small></span>}</span>
            </button>
          ))}
        </div>
      ) : <p className="empty">아직 담은 책이 없어요.</p>}
      {book && (
        <div className="book-detail">
          <div className="book-cover small">{book.cover ? <img src={book.cover} alt="" /> : <span className="book-noc"><b>{book.title}</b></span>}</div>
          <form className="addf col" style={{ flex: 1 }} onSubmit={e => { const v = formVals(e); if (v.title) act.updateBook(cat.id, book.id, { title: v.title, author: v.author, readAt: v.readAt || null }); setOpen(null) }}>
            <input className="inp" name="title" defaultValue={book.title} maxLength={80} aria-label="책 제목" key={'t' + book.id} />
            <input className="inp" name="author" defaultValue={book.author} maxLength={60} placeholder="저자" aria-label="저자" key={'a' + book.id} />
            <label className="sub">다 읽은 날 <input className="inp" name="readAt" type="date" defaultValue={book.readAt || ''} style={{ width: 'auto' }} key={'r' + book.id} /></label>
            <div className="row">
              <CoverPick value={book.cover} onChange={c => act.updateBook(cat.id, book.id, { cover: c })} />
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
