import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NavegacionComponent } from './modulos/navegacion/navegacion';

@Component({
  imports: [RouterOutlet, FormsModule, ReactiveFormsModule, NavegacionComponent],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('GestionAerea');
}
