$(function() {
  "use strict";

  var detect = $("#detect");
  var header = $('#header');
  var content = $('#content');
  var input = $('#input');
  var status = $('#status');
  var myName = false;
  var author = null;
  var loggedIn = false;
  var socket = $.atmosphere;
  var subSocket;
  var transport = 'websocket';

  /**  
   * Used to demonstrate the request.onTransportFailure callback. 
   * Not mandatory.
   */
  var sseSupported = false;

  /**
   * Define a list of transports. The Atmosphere library code will take
   * care of checking whether each of them is supported or not. 
   */
  var transports = [];
  transports[0] = "websocket";
  transports[1] = "sse";
  transports[2] = "jsonp";
  transports[3] = "long-polling";
  transports[4] = "streaming";
  transports[5] = "ajax";

  /**  
   * Loop through the possible transports, and show a message stating
   * whether each transport is supported.
   */
  $.each(transports, function (index, tr) {
     var req = new $.atmosphere.AtmosphereRequest();

     req.url = "/the-chat";
     req.contentType = "application/json";
     req.transport = tr;
     req.headers = { "X-SCALATRA-SAMPLE" : "true" };

     req.onOpen = function(response) {
       detect.append('<p><span style="color:blue">' + tr + 
        ' supported: '  + '</span>' + (response.transport == tr));
     };

     req.onReconnect = function(r) { r.close() };

     socket.subscribe(req)
  });


  /* Below is code that can be re-used */


  /**
   * Make a persistent connection to our server-side atmosphere method.
   */
  var request = {
    url: "/the-chat",
    contentType: "application/json",
    logLevel: 'debug',
    shared: true,
    transport: transport,
    trackMessageLength : true,
    fallbackTransport: 'long-polling'
  };

  /**
   * This runs when the connection is first made.
   */
  request.onOpen = function(response) {
    content.html($('<p>', {
      text: 'Atmosphere connected using ' + response.transport
    }));
    input.removeAttr('disabled').focus();
    status.text('Choose name:');
    transport = response.transport;

    // If we're using the "local" transport, it means we're probably
    // already connected in another browser tab or window. In this case,
    // ask the user for their name.
    if (response.transport == "local") {
      subSocket.pushLocal("Name?");
    }
  };

  /**  
   * You can share messages between windows/tabs. 
   * 
   * Atmosphere can detect whether a message has come from the same
   * browser instance, and allow you to take action on it.
   * 
   * This keeps your users from getting multiple connections from the 
   * same browser instance, and helps ensure your users can be notified
   * if they happen to crack a few tabs which both point at the same
   * Atmosphere connection.
   */
  request.onLocalMessage = function(message) {
    if (transport != 'local') {
      header.append($('<h4>', {
        text: 'A new tab/window has been opened'
      }).css('color', 'green'));
      if (myName) {
        subSocket.pushLocal(myName);
      }
    } else {
      if (!myName) {
        myName = message;
        loggedIn = true;
        status.text(message + ': ').css('color', 'blue');
        input.removeAttr('disabled').focus();
      }
    }
  };

  /**  
   * Demonstrates how you can customize the fallbackTransport
   * using the onTransportFailure function.
   */
  request.onTransportFailure = function(errorMsg, r) {
    jQuery.atmosphere.info(errorMsg);
    if (window.EventSource) {
      r.fallbackTransport = "sse";
      transport = "see";
    }
    header.html($('<h3>', {
      text: 'Atmosphere Chat. Default transport is WebSocket, fallback is ' +
       r.fallbackTransport
    }));
  };

  /**
   * Runs when the client reconnects to Atmosphere.
   */
  request.onReconnect = function(rq, rs) {
    socket.info("Reconnecting")
  };

  /**
   * This is what runs when an Atmosphere message is pushed from the
   * server to this client.
   */
  request.onMessage = function(rs) {

    // We need to be logged in.
    if (!myName) return;

    var message = rs.responseBody;
    try {
      var json = jQuery.parseJSON(message);
      console.log("got a message")
      console.log(json)
    } catch (e) {
      console.log('This doesn\'t look like a valid JSON object: ', 
        message.data);
      return;
    }

    if (!loggedIn) {
      loggedIn = true;
      status.text(myName + ': ').css('color', 'blue');
      input.removeAttr('disabled').focus();
      subSocket.pushLocal(myName);
    } else {
      input.removeAttr('disabled');
      var me = json.author == author;

      var date = typeof(json.time) == 'string' ? 
        parseInt(json.time) : json.time;

      addMessage(json.author, json.message, me ? 'blue' : 'black', 
        new Date(date));
    }
  };

  /**
   * When the connection closes, run this:
   */
  request.onClose = function(rs) {
    loggedIn = false;
  };

  /**
   * Run this when a connection error occurs.
   */
  request.onError = function(rs) {
    content.html($('<p>', {
      text: 'Sorry, but there\'s some problem with your ' + 
      'socket or the server is down'
    }));
  };

  // Subscribe to receive events from Atmosphere.
  subSocket = socket.subscribe(request);

  /**
   * This is the chat client part.
   */
  input.keydown(function(e) {
    // Send a message when the <enter> key is pressed.
    if (e.keyCode === 13) {
      var msg = $(this).val();

      // The first message is always the author's name.
      if (author == null) {
        author = msg;
      }

      // Format the json message our atmosphere action will receive.
      var json = { author: author, message: msg };

      // Send the message.
      subSocket.push(jQuery.stringifyJSON(json));

      // Reset the chat text field.
      $(this).val('');

      if (myName === false) {
        myName = msg;
        loggedIn = true;
        status.text(myName + ': ').css('color', 'blue');
        input.removeAttr('disabled').focus();
        subSocket.pushLocal(myName);
      } else {
        addMessage(author, msg, 'blue', new Date);
      }
    }
  });

  function addMessage(author, message, color, datetime) {
    content.append('<p><span style="color:' + color + '">' + author + '</span> @ ' + +(datetime.getHours() < 10 ? '0' + datetime.getHours() : datetime.getHours()) + ':' + (datetime.getMinutes() < 10 ? '0' + datetime.getMinutes() : datetime.getMinutes()) + ': ' + message + '</p>');
  }
});