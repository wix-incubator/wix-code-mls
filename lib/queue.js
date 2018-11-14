import Queue from 'promise-queue';

export default function MakeQueue(concurrency, tasks) {
  return new Promise(function(resolve, reject) {
    let q = new Queue(concurrency, Infinity, {onEmpty: function() {
      if (q.getPendingLength() === 0)
        resolve();
    }});

    if (tasks.length > 0)
      tasks.forEach(_ => q.add(_));
    else
      resolve();

  })
}