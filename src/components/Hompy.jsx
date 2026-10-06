import { useState } from 'react'
import { useStore } from '../hooks/useStore'
import { today, pretty, localDate } from '../lib/date'
import { stat, pc } from '../lib/stats'
import { AvaPicker, ConfirmX, Help, Ring, avaOf, nickOf, formVals } from './common'
import { makeAvatar } from '../lib/cutout'

const SHOW = 4  // 목록은 4개까지 보이고 나머지는 펼쳐서 본다

/** popup: 친구 탭에서 팝업으로 열 때 (홈피 고르기 줄 없음) */
export default function Hompy({ popup }) {
  const { S, act } = useStore()
  const [edit, setEdit] = useState(false)
  const [emoji, setEmoji] = useState(S.me.emoji)
  const [avatar, setAvatar] = useState(S.me.avatar || '')  // 수정 중인 프로필 사진
  const [more, setMore] = useState({ r: false, t: false })
  const id = S.view || S.uid, mine = id === S.uid, p = mine ? S.me : S.people[id]
  const who = [S.uid, ...S.me.friends.filter(f => S.people[f])]

  const switcher = (
    <div className="chips" role="group" aria-label="미니홈피 고르기">
      {who.map(w => (
        <button key={w} className={'chip' + (w === id ? ' on' : '')} onClick={() => act.view(w)}>
          {avaOf(S, w)} {nickOf(S, w)}{w === S.uid ? ' (나)' : ''}&nbsp;
        </button>
      ))}
    </div>
  )
  if (!p) return <div className="stack">{!popup && switcher}<div className="sheet"><p className="empty">이 친구의 미니홈피를 찾지 못했어요.</p></div></div>

  const days = mine ? S.days : S.vdays, t = today(), d = days[t], st = stat(p, d, mine)
  // 친구 것은 원래 공개 항목만 내려온다. 내 것도 미니홈피에서는 공개 항목만 보여 준다.
  const routines = (p.routines || []).filter(r => r.pub).map(r => ({ ...r, _done: !!d?.checks?.[r.id] }))
  const todos = (d?.todos || []).filter(x => x.pub).map(x => ({ ...x, _done: !!x.done }))
  const pubs = Object.values(days).filter(x => x?.pub && x.diary).sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 3)
  const isFriend = S.me.friends.includes(id)

  const saveProfile = e => {
    const v = formVals(e)
    if (!v.nick) return
    act.saveProfile({ nick: v.nick, bio: v.bio, emoji, ...('avatar' in S.me ? { avatar } : {}) })
    setEdit(false)
  }
  // 렌더 함수로 쓴다 (컴포넌트로 만들면 매 렌더마다 새 타입이라 다시 마운트됨)
  const list = (k, label, items) => (
    <section className="sheet">
      <h2><span>오늘 {label}</span><Help>{`공개로 설정한 ${label}만 보여요.`}</Help></h2>
      {items.length ? <>
        {(more[k] ? items : items.slice(0, SHOW)).map(i => (
          <div key={i.id} className={'item ro' + (i._done ? ' done' : '')}>
            <span className="mark">{i._done ? '✓' : ''}</span><span className="t">{i.text}</span>
          </div>
        ))}
        {items.length > SHOW && (
          <button className="linkh more-btn" onClick={() => setMore({ ...more, [k]: !more[k] })}>
            {more[k] ? '접기 ▴' : `${items.length - SHOW}개 더 보기 ▾`}
          </button>
        )}
      </> : <p className="empty">{mine ? `공개한 ${label}가 없어요. 오늘 탭에서 항목 옆의 비공개를 눌러 공개로 바꿀 수 있어요.` : `공개한 ${label}가 없어요.`}</p>}
    </section>
  )
  const cheer = e => { const v = formVals(e); if (v.text) { act.addCheer(v.text); e.currentTarget.reset() } }

  return (
    <div className="stack">
      {!popup && switcher}
      <section className="sheet">
        <div className="hero">
          <div className="ava">{avaOf(S, id)}</div>
          <div className="grow">
            <div className="row" style={{ gap: 10 }}>
              {mine && <button className="pencil" aria-label={edit ? '프로필 수정 닫기' : '프로필 수정'} title="프로필 수정"
                onClick={() => { setEdit(!edit); setEmoji(S.me.emoji); setAvatar(S.me.avatar || '') }}>✎</button>}
              <p className="nick">{p.nick}</p>
              <p className={'bio says' + (p.bio ? '' : ' none')}>{p.bio || (mine ? '한 줄 소개를 적어 보세요.' : '...')}</p>
              {d?.mood && <span className="pill">기분 {d.mood}</span>}
            </div>
            {!mine && (
              <div className="row" style={{ marginTop: 4 }}>
                {isFriend ? <span className="pill">내 친구</span>
                  : <button className="btn sm pri" onClick={() => act.addFriend(id)}>친구 추가</button>}
              </div>
            )}
          </div>
          <div className="rings">
            <Ring pct={pc(st.rD, st.rT)} label={`루틴 ${st.rD}/${st.rT}`} size={88} />
            <Ring pct={pc(st.tD, st.tT)} label={`투두 ${st.tD}/${st.tT}`} size={88} />
          </div>
        </div>
        {mine && edit && (
          <form className="addf col" onSubmit={saveProfile}>
            <label htmlFor="pf-nick">닉네임{p.handle && <Help>{`친구들에게 보이는 이름이라 언제든 바꿔도 돼요. 로그인 아이디는 「${p.handle}」 그대로예요.`}</Help>}</label>
            <input className="inp" id="pf-nick" name="nick" maxLength={16} defaultValue={p.nick} required />
            <label htmlFor="pf-bio">한 줄 소개</label>
            <input className="inp" id="pf-bio" name="bio" maxLength={60} defaultValue={p.bio || ''} placeholder="예: 올해는 진짜 아침형 인간" />
            {'avatar' in S.me && (
              <div className="row">
                <span className="ava">{avatar ? <img className="ava-img" src={avatar} alt="" /> : emoji}</span>
                <label className="btn sm">사진 {avatar ? '바꾸기' : '올리기'}
                  <input type="file" accept="image/*" hidden onChange={async e => {
                    const f = e.target.files?.[0]; e.target.value = ''
                    if (f) try { setAvatar(await makeAvatar(f)) } catch (err) { act.toast(err.message) }
                  }} />
                </label>
                {avatar && <button type="button" className="x" onClick={() => setAvatar('')}>사진 빼기</button>}
                <Help>사진은 가운데를 정사각형으로 잘라서 저장해요. 사진이 없으면 아래에서 고른 얼굴이 보여요.</Help>
              </div>
            )}
            <AvaPicker value={emoji} onChange={setEmoji} />
            <div className="row"><button className="btn pri">저장</button></div>
          </form>
        )}
      </section>

      <div className="cols">
        {list('r', '루틴', routines)}
        {list('t', '투두', todos)}
      </div>

      <section className="sheet">
        <h2><span>다이어리</span><Help>오늘 탭 일기에서 '공개하기'를 체크한 날의 일기가 여기에 모여요.</Help></h2>
        {pubs.length ? pubs.map(x => (
          <div key={x.date}><p className="sub">{pretty(x.date)} {x.mood || ''}</p><p className="diary-ro">{x.diary}</p></div>
        )) : <p className="empty">{mine ? '오늘 탭의 일기에서 공개하기를 체크하면 여기에 보여요.' : '공개한 일기가 아직 없어요.'}</p>}
      </section>

      <section className="sheet">
        <h2><span>방명록</span><Help>방명록은 친구만 남길 수 있어요. 내 홈피에 남겨진 글은 내가 지울 수 있어요.</Help></h2>
        {!mine && (
          <form className="addf" onSubmit={cheer}>
            <input className="inp" name="text" maxLength={100} placeholder="응원이나 잔소리 한마디" aria-label="방명록 글" />
            <button className="btn pri">남기기</button>
          </form>
        )}
        <div>
          {S.cheers.length ? S.cheers.map(c => (
            <div className="cheer" key={c.id}>
              <div className="ava s">{avaOf(S, c.from)}</div>
              <p><b>{nickOf(S, c.from)}</b> <small>{localDate(c.at)}</small><br />{c.text}</p>
              {(c.from === S.uid || mine) && <ConfirmX onConfirm={() => act.delCheer(c.id)} />}
            </div>
          )) : <p className="empty">{mine ? '아직 방명록이 비어 있어요. 친구들이 남긴 글이 여기에 보여요.' : '아직 방명록이 비어 있어요. 첫 글을 남겨 보세요.'}</p>}
        </div>
      </section>
    </div>
  )
}
