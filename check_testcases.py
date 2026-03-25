from app.database import db, TestCase, Defect
from app.main import app
from collections import Counter

with app.app_context():
    tcs = TestCase.query.all()
    print('Test cases by defect:')
    counts = Counter(tc.defect_id for tc in tcs)
    print(dict(counts))
    print('\nSample test cases:')
    for tc in tcs[:5]:
        print(f'  ID={tc.id}, defect_id={tc.defect_id}, filename={tc.filename}')
    
    print('\nDefects with test cases:')
    for defect_id in counts:
        d = Defect.query.get(defect_id)
        if d:
            print(f'  {d.id}: {d.name} - {counts[defect_id]} test cases')
