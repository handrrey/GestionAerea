import { Routes } from '@angular/router';

import { InicioSesionComponent } from './modulos/autenticacion/inicio-sesion/inicio-sesion';
import { RegistroComponent } from './modulos/autenticacion/registro/registro';
import { RecuperarClaveComponent } from './modulos/autenticacion/recuperar-clave/recuperar-clave';
import { HomeComponent } from './modulos/usuario/home/home';
import { PerfilComponent } from './modulos/usuario/perfil/perfil';
import { GestionAdministradoresComponent } from './modulos/administracion/gestion-administradores/gestion-administradores';
import { GestionVuelosComponent } from './modulos/administracion/gestion-vuelos/gestion-vuelos';
import { PerfilAdminComponent } from './modulos/administracion/perfil-admin/perfil-admin';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'inicio-sesion', component: InicioSesionComponent },
  { path: 'registro', component: RegistroComponent },
  { path: 'recuperar-clave', component: RecuperarClaveComponent },
  { path: 'perfil', component: PerfilComponent },
  { path: 'gestion-administradores', component: GestionAdministradoresComponent },
  { path: 'gestion-vuelos', component: GestionVuelosComponent },
  { path: 'perfil-admin', component: PerfilAdminComponent },
  { path: '**', redirectTo: 'home' }
];