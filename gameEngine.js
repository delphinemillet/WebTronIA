var FRAMEDELAY = 300;
var p1ai = false;

window.onload = function() {
  
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // map: 0 = empty, -1 = wall, 1 = player 1, 2 = player 2
  var map = [];
  // width and height constants
  var w = 0|(canvas.width/10);
  var h = 0|(canvas.height/10);

  // start out with a clear map with a border around the edges
  for(var j=0;j<h*w;j++) map[j] = 0;
  function addWall(x,y) {
    map[x+y*w] = -1;
    ctx.fillRect(x*10, y*10, 9, 9);
  }
  ctx.fillStyle='#111';
  for(var i=0;i<w;i++) { addWall(i,0); addWall(i,h-1); }
  for(j=0;j<h;j++) { addWall(0,j); addWall(w-1,j); }

  // Generate a random map with a random number of random walks of random
  // lengths.  symmetrically.
  var numwalks=Math.random()*10;
  for(var n=0;n<numwalks;n++) {
    var x = 0|(Math.random()*(w-4)) + 2;
    var y = 0|(Math.random()*(h-4)) + 2;
    var walklen = Math.random()*15;
    for(var k=0;k<walklen;k++) {
      addWall(x,y);
      addWall(w-1-x,h-1-y);
      var move = 0|(Math.random()*4);
      switch(move) {
        case 0: x++; break;
        case 1: x--; break;
        case 2: y++; break;
        case 3: y--; break;
      }
      if(x<2) x=2; if(x>w-3) x=w-3;
      if(y<2) y=2; if(y>h-3) y=h-3;
    }
  }

  // Move convention: 0 = left, 1 = up, 2 = right, 3 = down (corresponds to keyCode-37)
  var p1move = 2;
  var p2move = 0;
  var dx = [-1,0,1,0];
  var dy = [0,-1,0,1];
  var di = [-1,-w,1,w];
  var p1x = 1,
      p1y = h-2;
  var p2x = w-2,
      p2y = 1;
  var tmr, lastmove;
  var moveq = [];
  var gameover = false;

  function drawPlayer(x,y,player) {
    map[x+y*w] = player;
    ctx.fillStyle = player == 1 ? "#00f" : "#f00";
    ctx.fillRect(x*10,y*10,9,9);
  }

  drawPlayer(p1x,p1y,1);
  drawPlayer(p2x,p2y,2);

  function draw() {
    clearInterval(tmr); tmr=undefined;
    document.getElementById('result').innerHTML = "both players crashed; draw!<br>Hit space to play again.";
    gameover = true;
  }

  function crash(x,y,player) {
    clearInterval(tmr); tmr=undefined;
    var other = 3-player;
    ctx.fillStyle = player == 1 ? "#00a" : "#a00";
    ctx.fillRect(x*10,y*10,9,9);
    document.getElementById('result').innerHTML = "player "+player+" crashed; player "+other+" wins!<br>";
    gameover = true;
  }

  // this is a unit-cost specialization of dijkstra's algorithm
  function floodfill(distmap,idx) {
    var q = [idx], q2 = [];
    distmap[idx] = 1;
    var dist = 1;
    while(q.length) {
      dist++;
      for(var i=0;i<q.length;i++) {
        var idx = q[i];
        for(var move=0;move<4;move++) {
          var i2 = idx+di[move];
          if(map[i2] || distmap[i2])
            continue;
          distmap[i2] = dist;
          q2.push(i2);
        }
      }
      q = q2; q2 = [];
    }
    return distmap;
  }

  var p1score=0,p2score=0;
  var p1dist, p2dist;
  function evaluate_pos(myi,theiri)
  {
    // evaluate position
    p1dist = floodfill([], myi);
    p2dist = floodfill([], theiri);
    var score = 0;
    p2score = p1score = 0;
    for(var i=w+1;i<w*(h-1)-1;i++) {
      if(map[i]) continue; // wall?  forget it
      if(!p2dist[i]) { // unreachable to player 2?
        if(p1dist[i]) { p2score++; score++; }
        continue;
      }
      if(!p1dist[i]) { // unreachable to player 1?
        if(p2dist[i]) { p1score++; score--; }
        continue;
      }
      var d = p1dist[i] - p2dist[i];
      // closer to player 1?  count for p1's score
      if(d<0) { p2score++; score++; }
      else if(d>0) { p1score++; score--; } // else for p2's
    }
    return score;
  }

  // negamax -- minimax with alpha-beta pruning, simple implementation (see wikipedia)
  function negamax(myi,theiri,depth,a,b)
  {
    if(depth == 0) {
      return evaluate_pos(myi,theiri);
    }
    var bestmove=0;
    var bestaltmove=0;
    for(var move=0;move<4;move++) {
      var idx = myi+di[move];
      if(map[idx]) continue;
      map[idx] = 1;
      // recurse
      var _p1 = p1dist; // p[12]dist, p[12]score are the predicted distance tables and scores; they're kept here only for debugging
      var _p2 = p2dist;
      var _p1s = p1score;
      var _p2s = p2score;
      var score = -negamax(theiri,idx,depth-1, -b, -a);
      map[idx] = undefined;
      if(score > a) {
        a = score;
        bestmove = move;
        bestaltmove = p2move;
        if(a >= b)
          break;
      } else {
        p1dist = _p1; p1score = _p1s;
        p2dist = _p2; p2score = _p2s;
      }
    }
    // note: p1ai is buggy, because we're cheating: player 1 AI will probably
    // smash into a wall when P2 is about to lose.  we're just using the player
    // 1 move from the principal variation computed for player 2, and if player
    // 2 is doomed, there isn't one.
    if(p1ai) p1move=bestaltmove;
    p2move = bestmove;
    return a;
  }

  function frame() {
    if(moveq.length) {
      var move = moveq[0];
      var newidx = p1x+dx[move]+(p1y+dy[move])*w;
      // note: we only allow move (and pop it from the queue) if it isn't into a wall
      // this has the side-effect of making you go totally out of control if
      // you move right into a long wall, and we should probably pop "stuck"
      // moves after a frame or two
      if(!map[newidx]) {
        p1move = move;
        moveq.shift();
      }
    }

    var score = negamax(p2x+w*p2y,p1x+w*p1y,6,-1e6,1e6); // side effect of negamax() is to set p2move

    p1x += dx[p1move]; p1y += dy[p1move];
    p2x += dx[p2move]; p2y += dy[p2move];
    var p1idx = p1x+p1y*w;
    var p2idx = p2x+p2y*w;
    if((map[p1idx] && map[p2idx]) || p1idx == p2idx)
      draw();
    if(map[p1idx]) {
      crash(p1x,p1y,1);
      drawPlayer(p2x,p2y,2);
    }
    else if(map[p2idx]) {
      drawPlayer(p1x,p1y,1);
      crash(p2x,p2y,2);
    }
    else {
      drawPlayer(p1x,p1y,1);
      drawPlayer(p2x,p2y,2);
    }

    if(!gameover) {
      document.getElementById('result').innerHTML = "AI score: " + score +
        " (p1:"+p1score+" p2:"+p2score+")";
    }

    lastmove = p1move;
  }
  tmr = setInterval(frame, FRAMEDELAY);

  document.onkeydown = function(e) {
    //document.getElementById('d').innerHTML = "key: " + e.keyCode;
    switch(e.keyCode) {
      case 32: // space
        if(tmr) {
          clearInterval(tmr);
          tmr = undefined;
        } else {
          if(!gameover) {
            tmr = setInterval(frame, FRAMEDELAY);
          } else {
            init();
          }
        }
        break;
      case 65: // ???
        p1ai = !p1ai;
        break;
      case 37: // left
      case 38: // up
      case 39: // right
      case 40: // down
        // Move convention: 0 = left, 1 = up, 2 = right, 3 = down (corresponds to keyCode-37)
        var move = e.keyCode - 37;
        var lastmove = p1move;
        if(moveq.length) 
          lastmove = moveq[0];
        if(move != lastmove && Math.abs(lastmove - move) != 2) // don't allow reversal move sequences
          moveq.push(move);
        break;
    }
  }
}