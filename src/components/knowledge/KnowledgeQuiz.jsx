import { useEffect, useState } from 'react'
import * as api from '../../services/knowledgeService'

/* 지식 퀴즈: 관리자가 [관리]에서 넣은 문제를 풀어 본다. 고른 답은 각자 브라우저에 남는다 (점수·순위 없음) */
export default function KnowledgeQuiz({ st, toast }) {
  const [list, setList] = useState(null)
  const [filter, setFilter] = useState('all')   // all | todo | done
  useEffect(() => { api.listQuizzes().then(setList).catch(e => { setList([]); toast(e) }) }, [])
  if (list === null) return <div className="kn-page"><h2 className="kn-h2">지식 퀴즈</h2><p className="kn-empty">불러오는 중…</p></div>
  const done = list.filter(q => st.quiz[q.id] !== undefined).length
  const shown = list.filter(q => filter === 'all' || (filter === 'done') === (st.quiz[q.id] !== undefined))
  return (
    <div className="kn-page">
      <div className="kn-row">
        <h2 className="kn-h2">지식 퀴즈</h2>
        {list.length > 0 && <span className="kn-muted">{list.length}문제 중 {done}문제 풀었어요</span>}
      </div>
      {list.length > 0 && (
        <div className="kn-filters">
          {[['all', '전체'], ['todo', '안 푼 문제'], ['done', '푼 문제']].map(([k, l]) => <button key={k} className={'kn-chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
      )}
      <div className="kn-quizzes">
        {shown.map(q => <QuizCard key={q.id} q={q} n={list.indexOf(q) + 1} picked={st.quiz[q.id]} onPick={i => st.answerQuiz(q.id, i)} onReset={() => st.resetQuiz(q.id)} />)}
      </div>
      {!shown.length && <p className="kn-empty">{list.length ? '여기에 해당하는 문제가 없어요.' : '아직 퀴즈가 없어요.'}</p>}
    </div>
  )
}

function QuizCard({ q, n, picked, onPick, onReset }) {
  const answered = picked !== undefined, right = picked === q.answer
  return (
    <section className="kn-quiz">
      <p className="kn-quiz-q"><b>Q{n}.</b> {q.question}</p>
      <div className="kn-choices">
        {q.choices.map((c, i) => {
          const cls = !answered ? '' : i === q.answer ? ' right' : i === picked ? ' wrong' : ' dim'
          return <button key={i} className={'kn-choice' + cls} disabled={answered} onClick={() => onPick(i)}><span className="kn-cn">{i + 1}</span>{c}</button>
        })}
      </div>
      {answered && (
        <div className={'kn-result' + (right ? ' right' : ' wrong')}>
          <b>{right ? '정답이에요!' : `아쉬워요. 정답은 ${q.answer + 1}번이에요.`}</b>
          {q.explanation && <p>{q.explanation}</p>}
          <button className="x" onClick={onReset}>다시 풀기</button>
        </div>
      )}
    </section>
  )
}
