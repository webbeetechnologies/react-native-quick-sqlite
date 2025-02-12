import Chance from 'chance';
import {
  open,
  QuickSQLiteConnection,
  SQLBatchTuple,
} from 'react-native-quick-sqlite';
import {afterEach, beforeEach, describe, it} from './MochaRNAdapter';
import chai from 'chai';

let expect = chai.expect;
const chance = new Chance();
let db: QuickSQLiteConnection;

export function registerBaseTests() {
  describe('Raw queries', () => {
    let get: (SQL: any, ...args: any[]) => any;
    let all: (SQL: any, ...args: any[]) => any[] | undefined;

    beforeEach(() => {
      db = open({
        name: 'test',
      });

      db.execute('DROP TABLE IF EXISTS User;');
      db.execute(
        'CREATE TABLE User ( id INT PRIMARY KEY, name TEXT NOT NULL, age INT, networth REAL) STRICT;',
      );

      get = (SQL, ...args) => db.execute(`SELECT ${SQL}`, args)?.rows?._array[0];
      all = (SQL, ...args) => db.execute(`SELECT ${SQL} WINDOW win AS (ORDER BY rowid ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) ORDER BY rowid`, args)?.rows?._array;
    });

    afterEach(() => {
      if (!db) return;
      db.close();
      db.delete();
    })

    it('Insert', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();
      const res = db.execute(
        'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
        [id, name, age, networth],
      );

      expect(res.rowsAffected).to.equal(1);
      expect(res.insertId).to.equal(1);
      expect(res.metadata).to.eql([]);
      expect(res.rows?._array).to.eql([]);
      expect(res.rows?.length).to.equal(0);
      expect(res.rows?.item).to.be.a('function');
    });

    it('Query without params', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();
      db.execute(
        'INSERT INTO User (id, name, age, networth) VALUES(?, ?, ?, ?)',
        [id, name, age, networth],
      );

      const res = db.execute('SELECT * FROM User');

      expect(res.rowsAffected).to.equal(1);
      expect(res.insertId).to.equal(1);
      expect(res.rows?._array).to.eql([
        {
          id,
          name,
          age,
          networth,
        },
      ]);
    });

    it('Query with params', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();
      db.execute(
        'INSERT INTO User (id, name, age, networth) VALUES(?, ?, ?, ?)',
        [id, name, age, networth],
      );

      const res = db.execute('SELECT * FROM User WHERE id = ?', [id]);

      expect(res.rowsAffected).to.equal(1);
      expect(res.insertId).to.equal(1);
      expect(res.rows?._array).to.eql([
        {
          id,
          name,
          age,
          networth,
        },
      ]);
    });

    it('Failed insert', async () => {
      const id = chance.string();
      const name = chance.name();
      const age = chance.string();
      const networth = chance.string();
      // expect(
      try {
        db.execute(
          'INSERT INTO User (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        );
      } catch (e: any) {
        expect(typeof e).to.equal('object');

        expect(e.message).to.include(
          `cannot store TEXT value in INT column User.id`,
        );
      }
    });

    it('Transaction, auto commit', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();

      await db.transaction(tx => {
        const res = tx.execute(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        );

        expect(res.rowsAffected).to.equal(1);
        expect(res.insertId).to.equal(1);
        expect(res.metadata).to.eql([]);
        expect(res.rows?._array).to.eql([]);
        expect(res.rows?.length).to.equal(0);
        expect(res.rows?.item).to.be.a('function');
      });

      const res = db.execute('SELECT * FROM User');
      expect(res.rows?._array).to.eql([
        {
          id,
          name,
          age,
          networth,
        },
      ]);
    });

    it('Transaction, manual commit', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();

      await db.transaction(tx => {
        const res = tx.execute(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        );

        expect(res.rowsAffected).to.equal(1);
        expect(res.insertId).to.equal(1);
        expect(res.metadata).to.eql([]);
        expect(res.rows?._array).to.eql([]);
        expect(res.rows?.length).to.equal(0);
        expect(res.rows?.item).to.be.a('function');

        tx.commit();
      });

      const res = db.execute('SELECT * FROM User');
      expect(res.rows?._array).to.eql([
        {
          id,
          name,
          age,
          networth,
        },
      ]);
    });

    it('Transaction, executed in order', async () => {
      // ARRANGE: Setup for multiple transactions
      const iterations = 10;
      const actual: unknown[] = [];

      // ARRANGE: Generate expected data
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();

      // ACT: Start multiple transactions to upsert and select the same record
      const promises = [];
      for (let iteration = 1; iteration <= iterations; iteration++) {
        const promised = db.transaction(tx => {
          // ACT: Upsert statement to create record / increment the value
          tx.execute(
            `
              INSERT OR REPLACE INTO [User] ([id], [name], [age], [networth])
              SELECT ?, ?, ?,
                IFNULL((
                  SELECT [networth] + 1000
                  FROM [User]
                  WHERE [id] = ?
                ), 0)
          `,
            [id, name, age, id],
          );

          // ACT: Select statement to get incremented value and store it for checking later
          const results = tx.execute(
            'SELECT [networth] FROM [User] WHERE [id] = ?',
            [id],
          );

          actual.push(results.rows?._array[0].networth);
        });

        promises.push(promised);
      }

      // ACT: Wait for all transactions to complete
      await Promise.all(promises);

      // ASSERT: That the expected values where returned
      const expected = Array(iterations)
        .fill(0)
        .map((_, index) => index * 1000);
      expect(actual).to.eql(
        expected,
        'Each transaction should read a different value',
      );
    });

    it('Transaction, cannot execute after commit', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();

      await db.transaction(tx => {
        const res = tx.execute(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        );

        expect(res.rowsAffected).to.equal(1);
        expect(res.insertId).to.equal(1);
        expect(res.metadata).to.eql([]);
        expect(res.rows?._array).to.eql([]);
        expect(res.rows?.length).to.equal(0);
        expect(res.rows?.item).to.be.a('function');

        tx.commit();

        try {
          tx.execute('SELECT * FROM "User"');
        } catch (e) {
          expect(!!e).to.equal(true);
        }
      });

      const res = db.execute('SELECT * FROM User');
      expect(res.rows?._array).to.eql([
        {
          id,
          name,
          age,
          networth,
        },
      ]);
    });

    it('Incorrect transaction, manual rollback', async () => {
      const id = chance.string();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();

      await db.transaction(tx => {
        try {
          tx.execute(
            'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
            [id, name, age, networth],
          );
        } catch (e) {
          tx.rollback();
        }
      });

      const res = db.execute('SELECT * FROM User');
      expect(res.rows?._array).to.eql([]);
    });

    it('Correctly throws', () => {
      const id = chance.string();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();
      try {
        db.execute(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        );
      } catch (e: any) {
        expect(!!e).to.equal(true);
      }
    });

    it('Rollback', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();

      await db.transaction(tx => {
        tx.execute(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        );
        tx.rollback();
        const res = db.execute('SELECT * FROM User');
        expect(res.rows?._array).to.eql([]);
      });
    });

    it('Transaction, rejects on callback error', async () => {
      const promised = db.transaction(() => {
        throw new Error('Error from callback');
      });

      // ASSERT: should return a promise that eventually rejects
      expect(promised).to.have.property('then').that.is.a('function');
      try {
        await promised;
        expect.fail('Should not resolve');
      } catch (e) {
        expect(e).to.be.a.instanceof(Error);
        expect((e as Error)?.message).to.equal('Error from callback');
      }
    });

    it('Transaction, rejects on invalid query', async () => {
      const promised = db.transaction(tx => {
        console.log('execute bad start');
        tx.execute('SELECT * FROM [tableThatDoesNotExist];');
        console.log('execute bad done');
      });

      // ASSERT: should return a promise that eventually rejects
      expect(promised).to.have.property('then').that.is.a('function');
      try {
        await promised;
        expect.fail('Should not resolve');
      } catch (e) {
        expect(e).to.be.a.instanceof(Error);
        expect((e as Error)?.message).to.include(
          'no such table: tableThatDoesNotExist',
        );
      }
    });

    it('Transaction, handle async callback', async () => {
      let ranCallback = false;
      const promised = db.transaction(async tx => {
        await new Promise<void>(done => {
          setTimeout(() => done(), 50);
        });
        tx.execute('SELECT * FROM [User];');
        ranCallback = true;
      });

      // ASSERT: should return a promise that eventually rejects
      expect(promised).to.have.property('then').that.is.a('function');
      await promised;
      expect(ranCallback).to.equal(true, 'Should handle async callback');
    });

    it('Async transaction, auto commit', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();

      await db.transaction(async tx => {
        const res = await tx.executeAsync(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        );

        expect(res.rowsAffected).to.equal(1);
        expect(res.insertId).to.equal(1);
        expect(res.metadata).to.eql([]);
        expect(res.rows?._array).to.eql([]);
        expect(res.rows?.length).to.equal(0);
        expect(res.rows?.item).to.be.a('function');
      });

      const res = db.execute('SELECT * FROM User');
      expect(res.rows?._array).to.eql([
        {
          id,
          name,
          age,
          networth,
        },
      ]);
    });

    it('Async transaction, auto rollback', async () => {
      const id = chance.string(); // Causes error because it should be an integer
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();

      try {
        await db.transaction(async tx => {
          await tx.executeAsync(
            'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
            [id, name, age, networth],
          );
        });
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message)
          .to.include('SQL execution error')
          .and.to.include('cannot store TEXT value in INT column User.id');

        const res = db.execute('SELECT * FROM User');
        expect(res.rows?._array).to.eql([]);
      }
    });

    it('Async transaction, manual commit', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();

      await db.transaction(async tx => {
        await tx.executeAsync(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        );
        tx.commit();
      });

      const res = db.execute('SELECT * FROM User');
      expect(res.rows?._array).to.eql([
        {
          id,
          name,
          age,
          networth,
        },
      ]);
    });

    it('Async transaction, manual rollback', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();

      await db.transaction(async tx => {
        await tx.executeAsync(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        );
        tx.rollback();
      });

      const res = db.execute('SELECT * FROM User');
      expect(res.rows?._array).to.eql([]);
    });

    it('Async transaction, executed in order', async () => {
      // ARRANGE: Setup for multiple transactions
      const iterations = 10;
      const actual: unknown[] = [];

      // ARRANGE: Generate expected data
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();

      // ACT: Start multiple async transactions to upsert and select the same record
      const promises = [];
      for (let iteration = 1; iteration <= iterations; iteration++) {
        const promised = db.transaction(async tx => {
          // ACT: Upsert statement to create record / increment the value
          await tx.executeAsync(
            `
              INSERT OR REPLACE INTO [User] ([id], [name], [age], [networth])
              SELECT ?, ?, ?,
                IFNULL((
                  SELECT [networth] + 1000
                  FROM [User]
                  WHERE [id] = ?
                ), 0)
          `,
            [id, name, age, id],
          );

          // ACT: Select statement to get incremented value and store it for checking later
          const results = await tx.executeAsync(
            'SELECT [networth] FROM [User] WHERE [id] = ?',
            [id],
          );

          actual.push(results.rows?._array[0].networth);
        });

        promises.push(promised);
      }

      // ACT: Wait for all transactions to complete
      await Promise.all(promises);

      // ASSERT: That the expected values where returned
      const expected = Array(iterations)
        .fill(0)
        .map((_, index) => index * 1000);
      expect(actual).to.eql(
        expected,
        'Each transaction should read a different value',
      );
    });

    it('Async transaction, rejects on callback error', async () => {
      const promised = db.transaction(async () => {
        throw new Error('Error from callback');
      });

      // ASSERT: should return a promise that eventually rejects
      expect(promised).to.have.property('then').that.is.a('function');
      try {
        await promised;
        expect.fail('Should not resolve');
      } catch (e) {
        expect(e).to.be.a.instanceof(Error);
        expect((e as Error)?.message).to.equal('Error from callback');
      }
    });

    it('Async transaction, rejects on invalid query', async () => {
      const promised = db.transaction(async tx => {
        await tx.executeAsync('SELECT * FROM [tableThatDoesNotExist];');
      });

      // ASSERT: should return a promise that eventually rejects
      expect(promised).to.have.property('then').that.is.a('function');
      try {
        await promised;
        expect.fail('Should not resolve');
      } catch (e) {
        expect(e).to.be.a.instanceof(Error);
        expect((e as Error)?.message).to.include(
          'no such table: tableThatDoesNotExist',
        );
      }
    });

    it('Batch execute', () => {
      const id1 = chance.integer();
      const name1 = chance.name();
      const age1 = chance.integer();
      const networth1 = chance.floating();

      const id2 = chance.integer();
      const name2 = chance.name();
      const age2 = chance.integer();
      const networth2 = chance.floating();

      const commands: SQLBatchTuple[] = [
        [
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id1, name1, age1, networth1],
        ],
        [
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id2, name2, age2, networth2],
        ],
      ];

      db.executeBatch(commands);

      const res = db.execute('SELECT * FROM User');
      expect(res.rows?._array).to.eql([
        {id: id1, name: name1, age: age1, networth: networth1},
        {
          id: id2,
          name: name2,
          age: age2,
          networth: networth2,
        },
      ]);
    });

    it('Async batch execute', async () => {
      const id1 = chance.integer();
      const name1 = chance.name();
      const age1 = chance.integer();
      const networth1 = chance.floating();

      const id2 = chance.integer();
      const name2 = chance.name();
      const age2 = chance.integer();
      const networth2 = chance.floating();

      const commands: SQLBatchTuple[] = [
        [
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id1, name1, age1, networth1],
        ],
        [
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id2, name2, age2, networth2],
        ],
      ];

      await db.executeBatchAsync(commands);

      const res = db.execute('SELECT * FROM User');
      expect(res.rows?._array).to.eql([
        {id: id1, name: name1, age: age1, networth: networth1},
        {
          id: id2,
          name: name2,
          age: age2,
          networth: networth2,
        },
      ]);
    });

    it('Function test', async () => {
      db.function('add2', (a: number, b: number) => a + b , {deterministic: true});
      const res = db.execute('SELECT add2(?, ?) as result', [12, 4]);
      expect(res.rows?._array[0]?.result).to.eql(16);
    });

    it('should be able to register multiple functions with the same name', function () {
      db.function('fn', () => 0);
      db.function('fn', (a) => 1);
      db.function('fn', (a, b) => 2);
      db.function('fn', (a, b, c) => 3);
      db.function('fn', (a, b, c, d) => 4);
      expect(get('fn() as f')).to.deep.equal({f: 0});
      expect(get('fn(555) as f')).to.deep.equal({f: 1});
      expect(get('fn(555, 555) as f')).to.deep.equal({f: 2 });
      expect(get('fn(555, 555, 555) as f')).to.deep.equal({f: 3 });
      expect(get('fn(555, 555, 555, 555) as f')).to.deep.equal({f: 4});
      db.function('fn', (a, b) => 'foobar');
      expect(get('fn() as f')).to.deep.equal({f: 0 });
      expect(get('fn(555) as f')).to.deep.equal({f: 1});
      expect(get('fn(555, 555) as f')).to.deep.equal({f: 'foobar'});
      expect(get('fn(555, 555, 555) as f')).to.deep.equal({f: 3});
      expect(get('fn(555, 555, 555, 555) as f')).to.deep.equal({f: 4});
    });

    describe("Aggregation basic tests", async () => {
      let sumOfAge: number;
      let sumOfWorth: number;

      beforeEach(() => {
        sumOfAge = 0;
        sumOfWorth = 0;
        for (let i = 0; i < 5; i++) {
          const id = chance.integer();
          const name = chance.name();
          const age = chance.integer({
            min: 5,
            max: 100
          });
          const networth = chance.floating();
          db.execute(
            'INSERT INTO User (id, name, age, networth) VALUES(?, ?, ?, ?)',
            [id, name, age, networth],
          );
          sumOfAge += age;
          sumOfWorth += networth;
        }
      });

      it('simple aggregation test', async () => {
        db.aggregate('sumAge', {
          start: 0,
          step: (total, nextValue) => total + nextValue
        }, { deterministic: false });

        const res = db.execute('SELECT sumAge(age) as sumOfAge from User');
        expect(res.rows?._array[0]?.sumOfAge).to.eql(sumOfAge);
      });

      it('Aggregation test: should accept start function', async () => {
        db.aggregate('sumAge', {
          start: () => 0,
          step: (total, nextValue) => total + nextValue
        }, { deterministic: false });
        let res = db.execute('SELECT sumAge(age) as sumOfAge from User');
        expect(res.rows?._array[0]?.sumOfAge).to.eql(sumOfAge);
      });

      it('Aggregation test: should accept result function', async () => {
        db.aggregate('sumAge', {
          start: () => 0,
          step: (total, nextValue) => total + nextValue,
          result: (total) => total + 1
        }, { deterministic: false });
        let res = db.execute('SELECT sumAge(age) as sumOfAge from User');
        expect(res.rows?._array[0]?.sumOfAge).to.eql(sumOfAge + 1);
      });

      it('Aggregation test: should accept inverse function', async () => {
        db.aggregate('sumAge', {
          start: () => 0,
          step: (total, nextValue) => total + nextValue,
          inverse: (total, nextValue) => total - nextValue,
          result: (total) => total + 1
        }, { deterministic: false });
        let res = db.execute('SELECT sumAge(age) as sumOfAge from User');
        expect(res.rows?._array[0]?.sumOfAge).to.eql(sumOfAge + 1);
      });
    })
  });
}
