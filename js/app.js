//global vars
var isPlaying = false;   

var gainNode;

var root = teoria.note('b1');
var scale = root.scale('ionian');

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
  oscillator.type = 0; // sine wave
  oscillator.frequency.value = 2500; // value in hertz

  //attempt at white noise node to add some distortion to the bass, does kind of work but havent been able to filter it properly. there is a distortion method in the web audio api which may be better suited. left for now as not part of the core.
  // var noiseNode = audioCtx.createBufferSource()
  //   , buffer = audioCtx.createBuffer(1, 4096, audioCtx.sampleRate)
  //   , data = buffer.getChannelData(0);

  // for (var i = 0; i < 4096; i++) {
  //  data[i] = Math.random();
  // }
  // noiseNode.buffer = buffer;
  // noiseNode.loop = true;
  // // noiseNode.connect(audioCtx.destination);
  // noiseNode.start();
  //create gain node

  //create gain node - mater volume
  gainNode = audioCtx.createGain();
  gainNode.connect(audioCtx.destination);

  //create filter. not really working as yet. left for now as not in core.
  // var filter = audioCtx.createBiquadFilter();
  // filter.type = 0;  // Lowpass
  // filter.frequency.value =  0; //scale.get(4).fq();
  // filter.Q.value = 0;
  // filter.gain.value = 0;

  // oscillator.connect(filter);
  // noiseNode.connect(filter);
}

function initControls() {
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
    oscillator.connect(gainNode);
    // noiseNode.connect(gainNode);
    isPlaying = true;
  };

  function stop(){
    oscillator.disconnect(gainNode);
    // noiseNode .disconnect(gaininNode);
    isPlaying = false;
  };
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
    var videoHeight = video.offsetHeight;
    var videoWidth = video.offsetWidth;

    if (navigator.getUserMedia) {
      navigator.getUserMedia({
        audio: false,
        video: { 
          mandatory: {
            maxWidth: 640,
            maxHeight: 360
          }
        }
      }, function(stream) {
        video.src = window.URL.createObjectURL(stream);

        //Face recognition and tracking
        var htracker = new headtrackr.Tracker();
        htracker.init(video, canvas);
        htracker.start();

        document.addEventListener('headtrackrStatus', 
          function (event) {
            if (event.status == "getUserMedia") {
              alert("getUserMedia is supported!");
            }
          }
        );

        document.addEventListener('facetrackingEvent', 
          function (event) {
            coordinateToFrequency(event.x);
            // someFunction(event.y)
          }
        );

        function coordinateToFrequency(xCoordinate) {
          //invert because the video feed has been mirrored to be more intuitive
          var xPercent = xCoordinate/videoWidth;
          xPercent = 1-xPercent;
          //make it so there are only 7 possible values to correspond with the scale notes
          var xToIndex = Math.round( xPercent * 6) + 1 ;

          //set the oscilator frequncy to the note number based on face position
          var note = scale.get(xToIndex);
          var frequency;
          if (note) {
            $("#current-note").text(note.name());
            frequency = note.fq();
          }
          if (frequency) {
            oscillator.frequency.value = frequency;
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
