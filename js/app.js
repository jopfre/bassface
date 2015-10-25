//global vars
var isPlaying = false;   

var gainNode;

var root = teoria.note('b1');
var scale = root.scale('ionian');

var maxFilterFrequency = 2000;

//doc ready
$(init);

function init() {
  initCamera();
  initAudio();
  initControls();
}

function initAudio() { 
  //create cross broswer audio context
  var audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  //create oscillator
  oscillator = audioCtx.createOscillator();
  oscillator.start();
  oscillator.type = "sine";
  oscillator.frequency.value = 2500; //hertz

  //create distortion
  distortion = audioCtx.createWaveShaper();

  function makeDistortionCurve(amount) { //https://developer.mozilla.org/en-US/docs/Web/API/WaveShaperNode#Example
    var k = typeof amount === 'number' ? amount : 50,
      n_samples = 44100,
      curve = new Float32Array(n_samples),
      deg = Math.PI / 180,
      i = 0,
      x;
    for ( ; i < n_samples; ++i ) {
      x = i * 2 / n_samples - 1;
      curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
    }
    return curve;
  };

  distortion.curve = makeDistortionCurve(400);
  distortion.oversample = '4x';
  
  //create filter
  filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = maxFilterFrequency;

  //routing
  oscillator.connect(distortion);
  distortion.connect(filter);

  //create gain node (mater volume)
  gainNode = audioCtx.createGain();
  gainNode.connect(audioCtx.destination);
}

function initControls() {
  var $playStop = $("#hud");
  $(window).keydown(function(e){
    var key = e.which;
    switch(key) {   
      case 32: //space
        if (isPlaying) {
          stop();
        }
        else {
          play();
        }
        break;
    }
  });

  function play(){
    // oscillator.connect(gainNode);
    // distortion.connect(gainNode);
    filter.connect(gainNode);
    isPlaying = true;
    console.log("play");
  };

  function stop(){
    // oscillator.disconnect(gainNode);
    // distortion.disconnect(gainNode);
    filter.disconnect(gainNode);
    isPlaying = false;
    console.log("stop");
  };

  $playStop.on("click", function() {
    if (isPlaying) {
      stop();
    } else {
      play();
    }
  });

  var $sineButton = $("#sine");
  var $squareButton = $("#square");
  var $sawButton = $("#saw");
  var $triangleButton = $("#triangle");

  $sineButton.on("click", function() {
    $("#wave-controls button").removeClass("active");
    $(this).addClass("active");
    oscillator.type = "sine";
    console.log(oscillator.type);
  });
  $squareButton.on("click", function() {
    $("#wave-controls button").removeClass("active");
    $(this).addClass("active");
    oscillator.type = "square";
    console.log(oscillator.type);
  });
  $sawButton.on("click", function() {
    $("#wave-controls button").removeClass("active");
    $(this).addClass("active");
    oscillator.type = "sawtooth";
    console.log(oscillator.type);
  });
  $triangleButton.on("click", function() {
    $("#wave-controls button").removeClass("active");
    $(this).addClass("active");
    oscillator.type = "triangle";
    console.log(oscillator.type);
  });
}

function initCamera() {
  if (hasGetUserMedia()) {

    var errorCallback = function(e) {
      console.log('Reeeejected!', e);
    };

    navigator.getUserMedia  = navigator.getUserMedia ||
                              navigator.webkitGetUserMedia ||
                              navigator.mozGetUserMedia ||
                              navigator.msGetUserMedia;

    var video = document.getElementById('video');
    var canvas = document.getElementById('canvas');
    var overlay = document.getElementById('overlay');

    var windowWidth = window.innerWidth;
    var windowHeight = window.innerHeight;
    
    var $display = $('#video-wrapper, #video, #canvas, #overlay, #hud ') 

    function scaleVideo(videoWidth, videoHeight) { //test on mobile
      var headerHeight = $('header').height();
      var footerHeight = $('footer').height();
      var availableHeight = windowHeight - headerHeight - footerHeight;
      // find the biggest rectangle with the aspect ratio that fit within the viewport
      if (videoHeight/videoWidth * windowWidth < availableHeight) {
        //it fits
        $display.width(windowWidth);
        $display.height(videoHeight/videoWidth * windowWidth);
      } else {
        var scaledWidth = videoWidth/videoHeight * (availableHeight);
        $display.width(scaledWidth);
        $("#content").width(scaledWidth);
        $display.height(availableHeight);        
      }   
    }

    if (navigator.getUserMedia) {
      navigator.getUserMedia({
        audio: false,
        video: { 
          mandatory: {
          },
          optional: [
          ]
        }
      }, function(stream) {
        video.src = window.URL.createObjectURL(stream);

        video.addEventListener('playing', function() { //video dimensions only available once playing
          if (this.videoWidth === 0) {
            console.error('videoWidth is 0. Camera not connected?');
          } else {
            scaleVideo(video.videoWidth, video.videoHeight);
          }
        }, false);

        //Face recognition and tracking
        var htracker = new headtrackr.Tracker({ui: false});
        htracker.init(video, canvas);
        htracker.start();

        document.addEventListener('headtrackrStatus', 
          function (event) {
            var status = event.status;
            var $status = $("#status");
            switch(status) {
            case "getUserMedia" :
              message = "getUserMedia supported";
              break;
            case "no getUserMedia" :
              message = "getUserMedia not supported";
              break;
            case "camera found" :
              message = "camera found";
              break;
            case "no camera" :
              message = "camera not found";
              break;
            case "whitebalance" :
              message = "whitebalancing";
              break;
            case "detecting" :
              message = "finding face";
              break;
            case "hints" :
              message = "it's hard to find the face";
              break;
            case "found" :
              message = "face found";
              break;
            case "lost" :
              message = "lost face";
              break;
            case "redetecting" :
              message = "trying to redetect face";
              break;
            case "stopped" :
              message = "stopped";
              break;
            default :
              message ="nothing";
              break;
            }
            $("#status").text(message);
          }
        );

        document.addEventListener('facetrackingEvent', 
          function (event) {
            var videoWidth = $('#video').width();
            var videoHeight = $('#video').height();
            coordinateToOscilatorFrequency(event.x/videoWidth);
            coordinateToFilterFrequency(event.y/videoHeight)
            drawModel(event);
          }
        );

        function coordinateToOscilatorFrequency(xPercent) {
          var note;
          var frequency;
          // var xPercent = xCoordinate/videoWidth;

          //invert because the video feed has been mirrored to be more intuitive
          xPercent = 1-xPercent;
          //make it so there are only 7 (or a multiple of) possible values to correspond with the scale notes
          // var xToIndex = Math.round( xPercent * 6) + 1 ; //one octave
          var xToIndex = Math.round( xPercent * 13) + 1 ; //two octvates

          if (xToIndex<8) {
            note = scale.get(xToIndex);
          } else {
            note = scale.get(xToIndex-7).interval('P8');
          }

          //set the oscilator frequncy to the note number based on face position
          if (note) {
            $("#current-note").text(note.name());
            frequency = note.fq();
          }
          if (frequency) {
            oscillator.frequency.value = frequency;
          }
        }

        function coordinateToFilterFrequency(yPercent) {
          //invert because the video feed has been mirrored to be more intuitive
          // var yPercent = yCoordinate/videoHeight;
          yPercent = 1-yPercent;

          filter.frequency.value = maxFilterFrequency * yPercent;
        }

        function drawModel(event) {
          var overlayContext = document.getElementById("overlay").getContext("2d");
          // clear canvas
          overlayContext.clearRect(0,0,320,240);
          // once we have stable tracking, draw rectangle
          if (event.detection == "CS") {
            overlayContext.strokeStyle = "rgba(255, 255, 255, 0.2)";
            overlayContext.strokeRect(event.x, event.y, 320, 1);
            overlayContext.strokeRect(event.x, event.y, -320, 1);
            overlayContext.strokeRect(event.x, event.y, 1, 240);
            overlayContext.strokeRect(event.x, event.y, 1, -240);
          }
        }

      }, errorCallback);
    } else {
      // video.src = 'somevideo.webm'; // fallback.
    };
  } else {
    alert('getUserMedia() is not supported in your browser');
  }

  function hasGetUserMedia() {
    return !!(navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
  }

}
