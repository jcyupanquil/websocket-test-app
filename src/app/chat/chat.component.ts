import { Component, OnInit } from '@angular/core';
import { Client } from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import { Message } from './model/message';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit {

  private client: Client;

  connected: boolean = false;

  createdMessage: Message = new Message();
  messages: Message[] = [];
  writingMessage: string;
  clientId: string;

  constructor() {
    this.clientId = 'rid-' + new Date().getUTCMilliseconds() + '-' + Math.random().toString(36).substr(2);
  }

  ngOnInit() {
    this.client = new Client();
    this.client.webSocketFactory = () => {
      return new SockJS("http://localhost:8080/ws-services");
    }

    this.client.onConnect = (frame) => {
      console.log('Connected: ' + this.client.connected + ' : ' + frame);
      this.connected = true;

      // message subscription
      this.client.subscribe('/chat/message', event => {
        let brokerMessage: Message = JSON.parse(event.body) as Message;
        brokerMessage.date = new Date(brokerMessage.date);

        if (!this.createdMessage.color && brokerMessage.type === 'NEW_USER'
          && this.createdMessage.username === brokerMessage.username) {
          this.createdMessage.color = brokerMessage.color;
        }

        this.messages.push(brokerMessage);
      });

      // writing action subscription
      this.client.subscribe('/chat/writing', event => {
        this.writingMessage = event.body;
        setTimeout(() => this.writingMessage = null, 2000);
      });

      //sbuscribing to chat history
      this.client.subscribe('/chat/history/' + this.clientId, event => {
        // this.client.subscribe('/chat/history', event => {
        const history = JSON.parse(event.body) as Message[];
        this.messages = history.map(message => {
          message.date = new Date(message.date);
          return message;
        }).reverse();
      });

      // get the history
      this.client.publish({
        destination: '/app/history',
        body: this.clientId
      })

      // Notify there's a new connected user
      this.createdMessage.type = 'NEW_USER'
      this.client.publish({
        destination: '/app/message',
        body: JSON.stringify(this.createdMessage)
      });

    }


    this.client.onDisconnect = (frame) => {
      console.log('Disconnected: ' + !this.client.connected + ' : ' + frame);
      this.connected = false;
      this.messages = [];
      this.createdMessage = new Message();
    }

  }

  connect(): void {
    this.client.activate();
  }

  disconnect(): void {
    this.client.deactivate();
  }

  sendMessage(): void {
    this.createdMessage.type = 'MESSAGE';
    this.client.publish({
      destination: '/app/message',
      body: JSON.stringify(this.createdMessage)
    });
    this.createdMessage.text = '';
  }

  fireWriting(): void {
    this.client.publish({
      destination: '/app/writing',
      body: this.createdMessage.username
    });
  }

}
