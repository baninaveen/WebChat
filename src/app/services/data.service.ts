
import {mergeMap, takeWhile, pairwise, map,  expand } from 'rxjs/operators';











import { Injectable } from '@angular/core';
import { Observable ,  from ,  zip, of } from 'rxjs';

import { HttpHandlerService } from './http_handler.service';
import { MessageContentType, Message } from '../model/message';
import { Thread } from '../model/thread';
import { Repository, IdToMessages, IdToThread } from '../model/repository';

@Injectable()
export class DataService implements Repository {
  smsRepo: IdToMessages = {};
  threadRepo: IdToThread = {};

  constructor(private http: HttpHandlerService) {
    this.getRandomUsers().subscribe((t: Thread) => {
      this.threadRepo[t.id] = t;
      this.genMessages(t.id, t.userIDs).subscribe(m => {
        this.smsRepo[m.threadID] = this.smsRepo[m.threadID] || [];
        this.smsRepo[m.threadID].push(m);

        // set message to last
        t.timestamp = m.timestamp;
        t.snippet = m.content;
        t.unreadCount = this.chooseAny([0, 0, 0, 0, 1, 2, 3, 5, 8]);
      });
    });
  }

  getMessages(threadID: string): Message[] {
    return this.smsRepo[threadID];
  }

  getThreads(): Thread[] {
    return Object.values(this.threadRepo);
  }

  getThreadInfo(id: string): Thread {
    return this.threadRepo[id];
  }

  getQuotes(): Observable<string> {
    return this.http.getAndCache('https://talaikis.com/api/quotes/').pipe(
      mergeMap(x => x),
      map(x => x['quote']),);
  }

  genMessages(threadID: string, userIDs: string[]): Observable<Message> {
    const day = 86400000;
    let lastTimeStamp = Date.now() - day * 3;
    return this.getQuotes().pipe(
      map(quote => {
        const m = new Message();
        m.contentType = MessageContentType.PlainText;
        m.content = quote;
        m.userID = this.chooseAny([...userIDs, 'me']);
        lastTimeStamp = this.getTimeAfter(lastTimeStamp);
        m.timestamp = lastTimeStamp;
        m.threadID = threadID;
        return m;
      }),
      takeWhile(m => m.timestamp < Date.now()),
      pairwise(),
      mergeMap((pair: Message[]) => {
        if (pair.length === 1) {
          pair[0].isLocalLast = true;
          pair[0].isNewDay = true;
          return of(pair[0]);
        }

        const curr = pair[0];
        const next = pair[1];
        if (curr.userID !== next.userID) {
          curr.isLocalLast = true;
        }
        if (new Date(curr.timestamp).getDate() !== new Date(next.timestamp).getDate()) {
          next.isNewDay = true;
        }
        return of(curr);
      }),);
  }

  getRandomUsers(): Observable<Thread> {
    const cap = (x: string) => x.charAt(0).toUpperCase() + x.substr(1);
    return this.http
      .getAndCache(
        'https://randomuser.me/api/?inc=name,cell,picture&results=20').pipe(
      map(x => x['results']),
      mergeMap(x => x),
      map(x => {
        const thread = new Thread();
        thread.name = cap(x['name']['first']) + ' ' + cap(x['name']['last']);
        thread.avatar = x['picture']['large'];
        thread.id = x['cell'];
        thread.userIDs = [thread.id];
        return thread;
      }),pairwise(),
      mergeMap((pair: Thread[]) => {
        const prob = this.randomInt(0, 100);
        if (pair.length < 2 || prob < 75) {
          return pair;
        }
        const x = pair[0];
        const y = pair[1];
        const thread = new Thread();
        thread.name = x.name + ', ' + y.name;
        thread.avatar = 'https://image.freepik.com/free-icon/group_318-27951.jpg';
        // for merging avatars, see https://stackoverflow.com/a/15620872
        thread.id = x.id + y.id;
        thread.userIDs = [x.id, y.id];
        pair.push(thread);
        return pair;
      }),);
  }

  // Returns a random integer between min (included) and max (included)
  randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  chooseAny<E>(arr: E[]): E {
    if (!arr || arr.length === 0) {
      throw new Error('cannot choose from null or empty array');
    }
    return arr[this.randomInt(0, arr.length - 1)];
  }

  // a day is about 86400000 milliseconds
  getTimeAfter(timestamp: number): number {
    return timestamp + this.randomInt(0, 50000000);
  }
}
