import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonAvatar,
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  informationCircleOutline,
  logOutOutline,
  mailOutline,
} from 'ionicons/icons';
import { AuthService } from '../core/auth.service';
import { RealtimeService } from '../core/realtime.service';
import { PushService } from '../core/push.service';

@Component({
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonAvatar, IonBadge, IonButton, IonContent, IonHeader,
    IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonTitle, IonToolbar,
  ],
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage {
  readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly push = inject(PushService);
  private readonly router = inject(Router);

  error = '';
  signingOut = false;
  displayNameDraft='';savingName=false;nameFeedback='';
  currentPassword='';newPassword='';confirmPassword='';changingPassword=false;passwordFeedback='';
  savingAvatar=false;avatarFeedback='';

  constructor() {
    addIcons({
      alertCircleOutline, checkmarkCircleOutline,
      informationCircleOutline, logOutOutline, mailOutline,
    });
  }

  initials(name?: string): string {
    return (name ?? 'OS').trim().split(/\s+/).slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '').join('') || 'OS';
  }

  ionViewWillEnter():void {
    this.displayNameDraft=this.auth.profile()?.displayName??'';
    this.nameFeedback='';
  }
  async saveDisplayName():Promise<void> {
    if(this.savingName)return;
    const name=this.displayNameDraft.trim();
    if(name.length<2||name.length>80){this.nameFeedback='Display name must be 2–80 characters';return}
    this.savingName=true;this.nameFeedback='';
    try{await this.auth.updateDisplayName(name);this.nameFeedback='Profile name saved.';}
    catch(e){this.nameFeedback=(e as Error).message||'Unable to save profile'}
    finally{this.savingName=false}
  }

  async selectAvatar(event:Event):Promise<void>{
    const input=event.target as HTMLInputElement;
    const image=input.files?.[0];
    input.value='';
    if(!image||this.savingAvatar)return;
    this.avatarFeedback='';
    if(!['image/png','image/jpeg','image/webp'].includes(image.type)||image.size>2*1024*1024||image.size<12){
      this.avatarFeedback='Choose a JPG, PNG, or WebP image up to 2 MB.';return;
    }
    this.savingAvatar=true;
    try{await this.auth.uploadAvatar(image);this.avatarFeedback='Profile photo updated.';}
    catch(error){this.avatarFeedback=(error as Error).message||'Unable to update photo';}
    finally{this.savingAvatar=false;}
  }
  async removeAvatar():Promise<void>{
    if(this.savingAvatar)return;
    this.savingAvatar=true;this.avatarFeedback='';
    try{await this.auth.removeAvatar();this.avatarFeedback='Profile photo removed.';}
    catch(error){this.avatarFeedback=(error as Error).message||'Unable to remove photo';}
    finally{this.savingAvatar=false;}
  }

  async changePassword():Promise<void>{
    if(this.changingPassword)return;
    this.passwordFeedback='';
    if(this.newPassword!==this.confirmPassword){this.passwordFeedback='New passwords do not match';return}
    this.changingPassword=true;
    try{
      await this.auth.changePassword(this.currentPassword,this.newPassword);
      this.currentPassword='';this.newPassword='';this.confirmPassword='';
      this.passwordFeedback='Password updated successfully.';
    }catch(e){this.passwordFeedback=(e as Error)?.message||'Unable to change password'}
    finally{this.changingPassword=false}
  }

  async logout(): Promise<void> {
    if (this.signingOut) return;
    this.signingOut = true;
    this.error = '';
    try {
      this.realtime.disconnect();
      try {
        await this.push.stop();
      } catch (error) {
        console.warn('Push cleanup failed during logout:', error);
      }
      await this.auth.logout();
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    } catch (error) {
      this.error = (error as Error).message || 'Unable to sign out. Please try again.';
    } finally {
      this.signingOut = false;
    }
  }
}
