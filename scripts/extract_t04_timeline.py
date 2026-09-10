"""Build the public, curated timeline from a local Harbor trajectory (stdlib only).

Scores below are the rounded values reported in agent status messages, not an
exhaustive extraction of checkpoint evaluations. Time is message/report time.
Run: python3 scripts/extract_t04_timeline.py [path/to/harbor/trial]
"""
from pathlib import Path
from datetime import datetime
import json
import sys
ROOT = Path(__file__).resolve().parents[1]
trial = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / '05-sprint__nEPZiiK'
steps = {s['step_id']: s for s in json.loads((trial / 'agent/trajectory.json').read_text())['steps']}
# step, reported score, evaluation seed count, outcome, editorial label
rows = [
(20,None,None,'experiment','Reference controller falls in <1 s'),
(26,.092,3,'improved','PPO learns to stay upright'),
(36,.186,3,'improved','Survival reaches 6.43 s'),
(43,.571,3,'improved','A first major jump'),
(53,None,3,'rejected','More accurate, but falls earlier'),
(62,None,3,'rejected','Accuracy curriculum regresses'),
(64,None,None,'experiment','2 ms physics + stronger pushes'),
(70,.718,3,'improved','First complete design-seed clips'),
(74,None,3,'rejected','Finer physics: one early fall'),
(82,.736,3,'improved','Finer physics begins to transfer'),
(85,.706,15,'audit','Broader check: 19.63 s survival'),
(91,None,None,'rejected','Early checkpoint averaging fails'),
(93,None,3,'rejected','Accuracy gains lose a full clip'),
(98,.734,3,'rejected','New checkpoint trails the best'),
(110,None,None,'rejected','8,192 worlds exceed GPU memory'),
(115,None,None,'experiment','6,144 worlds train successfully'),
(119,.760,3,'improved','Match friction + full-clip starts'),
(122,.754,15,'audit','15 / 15 episodes complete'),
(129,.788,3,'improved','Training beats the timing sweep'),
(132,None,15,'rejected','Broader seeds reveal another fall'),
(135,.777,15,'improved','25 / 75 blend restores completion'),
(139,.806,3,'improved','Single network overtakes blend'),
(142,.796,15,'audit','Single network passes all 15'),
(145,.814,3,'improved','Design-seed score rises again'),
(148,None,15,'rejected','Broader test rejects the gain'),
(153,.801,15,'tradeoff','Higher mean, one fall'),
(159,None,None,'rejected','New blends do not improve'),
(162,None,None,'experiment','Diagnose torso-height failure'),
(165,.808,15,'improved','Recovery training continues'),
(167,None,None,'experiment','8-frame history + clean critic'),
(180,.831,15,'improved','Recurring push failure resolved'),
(190,.853,15,'improved','Fine-position reward refinement'),
(195,.855,15,'improved','Learn a phase correction table'),
(198,None,15,'rejected','Feed-forward candidate falls'),
(202,None,15,'rejected','Lower pose error, early fall'),
(209,.875,3,'tradeoff','Design gain; broader check falls'),
(216,.871,45,'improved','Blend completes all 45 seeds'),
(218,.878,45,'improved','Single network beats blends'),
(224,.880,45,'improved','Less exploration, finer rewards'),
(231,.887,45,'improved','Add reference-state features'),
(238,.892,3,'audit','Reference-state design check'),
(240,.891,45,'improved','Reference features pass 45 seeds'),
(247,.892,45,'improved','Reference-state refinement'),
(261,.897,45,'improved','Baseline for velocity experiment'),
(265,.896,45,'rejected','Root-velocity reward: no gain yet'),
(267,.898,45,'improved','Velocity refinement inches ahead'),
(281,.899,45,'improved','8-frame blend reaches a plateau'),
(284,None,None,'experiment','Transfer to 16-frame history'),
(304,.901,45,'improved','16 frames break the plateau'),
(307,.902,45,'improved','Mixing history lengths helps'),
(309,.904,45,'improved','Single 16-frame policy leads'),
(313,.905,45,'improved','Precision training continues'),
(316,.9055,45,'improved','Average three checkpoint weights'),
(321,.906,45,'improved','Prepare a 100-seed audit'),
(324,.900,100,'tradeoff','Fresh seeds expose a fall'),
(328,.905,145,'audit','Weight average passes 145 / 145'),
(331,.908,45,'improved','Stronger pushes + more training'),
(334,.908,145,'audit','New average passes 145 seeds'),
(337,.909,45,'improved','Remove entropy bonus'),
(343,.9094,45,'improved','Late precision gains'),
(347,.9095,45,'improved','Recent checkpoint average'),
(350,.9092,145,'audit','Broader gain holds'),
(360,None,45,'tradeoff','5% smoothing reduces jerk'),
(364,None,145,'audit','Light smoothing passes 145'),
(371,.9099,145,'improved','Later average improves accuracy'),
(375,None,None,'tradeoff','Smoothing trades accuracy for jerk'),
(378,None,45,'rejected','Fine-reward update: no gain yet'),
(386,.9115,45,'improved','Precision refinement pays off'),
(390,.9108,145,'audit','Gain holds across 145 seeds'),
(393,.9113,145,'improved','New average completes every clip'),
(396,.9111,145,'tradeoff','Smoother actions, lower score'),
(400,.9127,45,'improved','Another checkpoint average gains'),
(403,.9124,145,'audit','Larger comparison confirms gain'),
(406,.9135,45,'improved','Late single-network candidate'),
(409,.9130,145,'audit','Raw checkpoint passes 145'),
(412,.9132,145,'improved','Average edges ahead'),
(416,None,45,'rejected','Newest raw checkpoint falls'),
(420,.9140,45,'improved','Main-run average reaches 0.914'),
(424,None,45,'rejected','Averaging introduces a fall'),
(428,None,145,'rejected','Final raw checkpoint fails audit'),
(436,None,None,'rejected','Short continuation: no score gain'),
(439,.9137,345,'audit','Smoothed candidate passes 345'),
(443,None,200,'rejected','Fresh audit catches two late falls'),
(448,None,None,'experiment','Revisit robustness continuation'),
(452,None,None,'rejected','Earlier averages also fall'),
(458,.9124,545,'selected','Final policy: all 545 test runs completed without a fall')]
start = steps[5]['timestamp']
t0 = datetime.fromisoformat(start.replace('Z','+00:00'))
events=[]
for step,score,seeds,outcome,label in rows:
    s=steps[step]
    events.append({'id':f'step-{step}','step':step,'timestamp':s['timestamp'],'minutes':round((datetime.fromisoformat(s['timestamp'].replace('Z','+00:00'))-t0).total_seconds()/60,3),'score':score,'seeds':seeds,'outcome':outcome,'label':label,'evidence':s['message'].strip()})
data={'task':'T04','agent':'GPT-6 Astra','trial':trial.name,'started_at':start,'metric':'tracking_multi','time_basis':'Elapsed wall time at the logged status report, not exact checkpoint creation or evaluation completion time.','score_basis':'Curated rounded scores reported in agent status messages. Evaluation cohorts differ; lines connect only retained/improved reports within the same seed count, not a global best-so-far curve. No score is inferred for unscored attempts.','source':'agent/trajectory.json; final exact metric checked against artifacts/logs/artifacts/selection.json','final':json.loads((trial/'artifacts/logs/artifacts/selection.json').read_text())['mean'],'events':events}
(ROOT/'assets/blog/t04-hillclimb.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print(f'Exported {len(events)} sourced events, {sum(e["score"] is not None for e in events)} reported scores.')
