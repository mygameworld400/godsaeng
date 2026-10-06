import { useEffect, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { CatGlyph, ConfirmX, Help, avaOf, nickOf, withImage } from './common'
import Md from './Md'
import PlanViewer, { normalize } from './PlanViewer'

/* 챌린지 화면: 참여한 사람, 간단한 설명, 개요(템플릿 개요), 참여/나가기, 참여자는 플랜 열기.
   플랜 진도는 gs_quest_members.progress 에 저장되고 참여자끼리 '모두' 탭에서 서로 본다. */

/** 챌린지 아이콘 = 연결된 추천 활동(하위 선택지)의 이름·아이콘·이미지 */
export function questCat(q, baseCats) {
  const b = baseCats.find(x => x.id === q.baseId)
  if (!b) return { name: '', icon: '🏆' }
  const o = q.optionId ? b.options.find(x => x.id === q.optionId) : null
  return withImage({ name: o ? o.name : b.name, icon: (o && o.icon) || b.icon, color: b.color, base: b.id, opt: o?.id }, baseCats)
}

/** 챌린지에 연결된 템플릿 불러오기 */
function useQuestTemplate(q) {
  const { act } = useStore()
  const [tpl, setTpl] = useState(null)
  useEffect(() => { if (q?.templateId) act.getTemplate(q.templateId).then(t => setTpl(t ? normalize(t) : null)).catch(() => {}) }, [q?.templateId, act])
  return tpl
}

const openPlan = id => { location.hash = 'cats/plan:' + id }

/** 챌린지 플랜 전체 화면 (팝업 대신). 진도는 내 참여 기록에 저장되고 '모두' 탭에서 참여자끼리 서로 본다. */
export function PlanScreen({ id, back }) {
  const { S, act } = useStore()
  const q = S.quests.find(x => x.id === id)
  const tpl = useQuestTemplate(q)
  const mine = q?.members.find(m => m.userId === S.uid)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  const people = q ? q.members.map(m => ({ id: m.userId, nick: nickOf(S, m.userId), ava: avaOf(S, m.userId), progress: m.progress })) : []
  return (
    <div className="plan-screen">
      <div className="plan-bar">
        <button className="btn sm" onClick={back}>‹ 돌아가기</button>
        <b>{q ? q.title : '챌린지'}</b>
      </div>
      <div className="plan-body">
        {!q ? <p className="empty">챌린지를 찾지 못했어요.</p>
          : !mine ? <div className="sheet"><p className="empty">참여한 사람만 플랜을 열 수 있어요.</p><div className="row"><button className="btn pri" onClick={() => act.joinQuest(q)}>참여하기</button></div></div>
          : !tpl ? <p className="empty">플랜을 불러오는 중…</p>
          : <PlanViewer tpl={tpl} progress={mine.progress} setProgress={v => act.setQuestProgress(q, v)} people={people} />}
      </div>
    </div>
  )
}

export default function QuestPage({ id, back }) {
  const { S, act } = useStore()
  const q = S.quests.find(x => x.id === id)
  const tpl = useQuestTemplate(q)

  if (!q) return <div className="sheet"><p className="empty">챌린지를 찾지 못했어요.</p><div className="row"><button className="btn" onClick={back}>‹ 돌아가기</button></div></div>
  const cat = questCat(q, S.baseCats)
  const mine = q.members.find(m => m.userId === S.uid)
  const people = q.members.map(m => ({ id: m.userId, nick: nickOf(S, m.userId), ava: avaOf(S, m.userId), progress: m.progress }))

  return (
    <div className="stack">
      <div className="row"><button className="btn sm" onClick={back}>‹ 돌아가기</button></div>
      <section className="sheet">
        <div className="hero">
          <CatGlyph cat={cat} size={64} />
          <div className="grow">
            <p className="sub">{cat.name}</p>
            <p className="nick">{q.title}</p>
          </div>
          {mine
            ? <div className="row">
                <button className="btn pri" onClick={() => openPlan(q.id)}>📖 플랜 열기</button>
                <ConfirmX onConfirm={() => act.leaveQuest(q)} label="나가기" className="btn sm" />
              </div>
            : <button className="btn pri" onClick={() => act.joinQuest(q)}>참여하기</button>}
        </div>
        {q.description && <p className="plan-text">{q.description}</p>}
      </section>

      <section className="sheet">
        <h2><span>참여한 사람</span><Help>참여하면 서로의 진행 상황을 플랜의 '모두' 탭에서 볼 수 있어요.</Help></h2>
        {people.length ? <div className="chips">{people.map(p => <span key={p.id} className="chip"><span className="ava s">{p.ava}</span>{p.nick}&nbsp;</span>)}</div>
          : <p className="empty">아직 참여한 사람이 없어요. 첫 번째로 참여해 보세요!</p>}
      </section>

      {tpl && (
        <section className="sheet">
          <h2><span>개요</span></h2>
          {tpl.intro.filter(s => s.title !== '처음 열 파일').map(s => (
            <details key={s.title} className="intro-sec" open={s.title === '진행 방식'}>
              <summary>{s.title}</summary>
              <Md text={s.body} />
            </details>
          ))}
        </section>
      )}

    </div>
  )
}
