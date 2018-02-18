# Client side web socket utility #

## Basic features ##

| **Name** | **Parameters** | **Definition**
| -------- | --------------- | -------------|
| `send()` | *message*: string,object | send a message to socket server |
| `setEventHandler()` | *event*: string *handler*: function | sets a handler for a socket event |
| `setEventHandlers()` | *handlers*: object | sets handlers for events. Handlers follow key=event value=handler |
| `addHandlers()` | *event*: string *handler* function | Adds additional handlers for socket events |
| `setDefaultHandler()` | *handler*: function | sets the default action handler for all events |
| `new Io()` | | Create a new instance of a event emitting client. 

## Usage ##

To create an instance of the socket client you need to reference it through a script tag that points to your server side instantiation of wsUtil

```html
<script data-th-src="${path.lib}"></script>
```

You will also need a reference to your client side web socket implementation

```html
<script data-th-src="${path.client}"></script>
```

**IMPORTANT** The library must be loaded before the implementation

```javascript

var cws = new ExpWS();
```

The constructor creates the socket connection automatically.

