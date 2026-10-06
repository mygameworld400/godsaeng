import { useStore } from '../hooks/useStore'
import { pretty } from '../lib/date'
import { chStat } from '../lib/stats'
import { ConfirmX, Help, avaOf, nickOf, formVals } from './common'

export default function Bets() {
  const { S, act } = useStore()
  const list = Object.values(S.ch).filter(c => c.members?.[S.uid] && c.members[S.uid] !== 'out').sort((a, b) => a.end < b.end ? 1 : -1)
  const friends = S.me.friends.filter(f => S.people[f])
  const nick = id => nickOf(S, id)

  const create = e => {
    const form = e.currentTarget, v = formVals(e)
    if (!v.title) return
    const invite = [...form.querySelectorAll('[data-friend]:checked')].map(c => c.dataset.friend)
    act.createBet(v.title, +v.days || 7, v.penalty, invite)
    form.reset()
  }

  return (
    <div className="stack">
      <form className="sheet" onSubmit={create}>
        <h2><span>새 내기 만들기</span><Help>오늘부터 시작해요. 매일 한 번 인증하고, 끝나는 날 가장 적게 지킨 사람이 벌칙을 받아요.</Help></h2>
        <div className="addf">
          <input className="inp" name="title" maxLength={30} placeholder="도전 (예: 매일 운동하기)" aria-label="도전 이름" required />
          <select className="inp" name="days" aria-label="기간" defaultValue="7">
            {[7, 14, 30, 100].map(n => <option key={n} value={n}>{n}일</option>)}
          </select>
        </div>
        <input className="inp" name="penalty" maxLength={40} placeholder="벌칙 (예: 진 사람이 치킨 쏘기)" aria-label="벌칙" />
        <div className="picks" role="group" aria-label="초대할 친구">
          {friends.length ? friends.map(f => (
            <label className="pick" key={f}><input type="checkbox" data-friend={f} />{avaOf(S, f)} {nick(f)}</label>
          )) : <span className="empty">친구 탭에서 친구를 먼저 추가하면 여기서 초대할 수 있어요.</span>}
        </div>
        <div className="row"><button className="btn pri">내기 시작</button></div>
      </form>

      {list.length ? list.map(c => {
        const s = chStat(c), me = c.members[S.uid], myRow = s.rows.find(r => r.id === S.uid)
        const invited = Object.keys(c.members).filter(k => c.members[k] === 'invited')
        let result = null
        if (s.ended && s.rows.length > 1) {
          const min = s.rows[s.rows.length - 1].n, max = s.rows[0].n
          result = min === max
            ? `무승부! 모두 ${max}일 지켰어요. 벌칙은 없어요.`
            : `벌칙 당첨: ${s.rows.filter(r => r.n === min).map(r => nick(r.id)).join(', ')} (${min}일)`
        } else if (s.ended) result = '내기가 끝났어요.'

        return (
          <section className="sheet" key={c.id}>
            <div className="bet-h">
              <h2><span>{c.title}</span></h2>
              <span className="pill">{s.ended ? '종료' : <><b>{s.elapsed}일째</b> / {s.total}일</>}</span>
            </div>
            <p className="sub">{pretty(c.start)} ~ {pretty(c.end)} · 만든 사람 {nick(c.by)}</p>
            <div className="penalty">벌칙: {c.penalty || '정하지 않음'}</div>
            {result && <div className="result">{result}</div>}
            {me === 'invited' && (
              <div className="row">
                <span>{nick(c.by)} 님이 이 내기에 초대했어요.</span>
                <button className="btn pri" onClick={() => act.joinBet(c.id, 'in')}>참가</button>
                <button className="btn" onClick={() => act.joinBet(c.id, 'out')}>거절</button>
              </div>
            )}
            <div className="lead">
              {s.rows.map(r => [
                <div key={r.id + 'a'} className="ava s">{avaOf(S, r.id)}</div>,
                <div key={r.id + 'n'} className="nm">{nick(r.id)}{r.today && !s.ended ? ' ✓' : ''}</div>,
                <div key={r.id + 'm'} className="meter" aria-hidden="true"><i style={{ width: (s.elapsed ? Math.round(r.n / s.elapsed * 100) : 0) + '%' }} /></div>,
                <div key={r.id + 'c'} className="cnt">{r.n}/{s.elapsed}일</div>,
              ])}
            </div>
            {invited.length > 0 && <p className="sub">초대 대기: {invited.map(nick).join(', ')}</p>}
            <div className="row">
              {me === 'in' && !s.ended && s.t >= c.start && (
                <button className={'btn' + (myRow?.today ? '' : ' hl')} onClick={() => act.checkBet(c.id)}>
                  {myRow?.today ? '오늘 인증 취소' : '오늘 했다! 인증'}
                </button>
              )}
              {me === 'in' && c.by !== S.uid && <button className="btn sm" onClick={() => act.joinBet(c.id, 'out')}>나가기</button>}
              {c.by === S.uid && <ConfirmX onConfirm={() => act.delBet(c.id)} label="내기 삭제" className="btn sm warn" />}
            </div>
          </section>
        )
      }) : <div className="sheet"><p className="empty">진행 중인 내기가 없어요. 위에서 첫 내기를 만들어 보세요.</p></div>}
    </div>
  )
}
