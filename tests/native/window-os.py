import ctypes as C,json,sys,time
from ctypes import wintypes as W
pid=int(sys.argv[1]);mode=sys.argv[2];needle=sys.argv[3] if len(sys.argv)>3 else ''
u=C.WinDLL('user32',use_last_error=True)
u.SetProcessDpiAwarenessContext.argtypes=[C.c_void_p];u.SetProcessDpiAwarenessContext(C.c_void_p(-4))
u.GetWindowThreadProcessId.argtypes=[W.HWND,C.POINTER(W.DWORD)]
u.GetWindowRect.argtypes=[W.HWND,C.POINTER(W.RECT)]
u.GetWindowLongPtrW.argtypes=[W.HWND,C.c_int];u.GetWindowLongPtrW.restype=C.c_ssize_t
u.ShowWindow.argtypes=[W.HWND,C.c_int];u.PostMessageW.argtypes=[W.HWND,W.UINT,W.WPARAM,W.LPARAM]
u.SetWindowPos.argtypes=[W.HWND,W.HWND,C.c_int,C.c_int,C.c_int,C.c_int,W.UINT]
rows=[]
@C.WINFUNCTYPE(W.BOOL,W.HWND,W.LPARAM)
def visit(h,_):
 owner=W.DWORD();u.GetWindowThreadProcessId(h,C.byref(owner));s=C.create_unicode_buffer(256);u.GetWindowTextW(h,s,256)
 cls=C.create_unicode_buffer(256);u.GetClassNameW(h,cls,256)
 if owner.value==pid and (s.value.startswith('Local Music') or (mode in ['dialogs','cancel-dialog'] and cls.value=='#32770')):
  rect=W.RECT();u.GetWindowRect(h,C.byref(rect));rows.append(dict(hwnd=h,title=s.value,visible=bool(u.IsWindowVisible(h)),minimized=bool(u.IsIconic(h)),topmost=bool(u.GetWindowLongPtrW(h,-20)&8),rect=[rect.left,rect.top,rect.right,rect.bottom]))
 return True
u.EnumWindows(visit,0)
if mode in ['list','dialogs']:print(json.dumps(rows));sys.exit()
selected=[r for r in rows if needle in r['title']];assert len(selected)==1,(needle,rows)
h=selected[0]['hwnd']
if mode in ['menus','menu-command']:
 u.GetMenu.argtypes=[W.HWND];u.GetMenu.restype=W.HANDLE
 u.GetSubMenu.argtypes=[W.HANDLE,C.c_int];u.GetSubMenu.restype=W.HANDLE
 u.GetMenuItemCount.argtypes=[W.HANDLE];u.GetMenuItemID.argtypes=[W.HANDLE,C.c_int];u.GetMenuItemID.restype=W.UINT
 u.GetMenuState.argtypes=[W.HANDLE,W.UINT,W.UINT];u.GetMenuState.restype=W.UINT
 u.GetMenuStringW.argtypes=[W.HANDLE,W.UINT,W.LPWSTR,C.c_int,W.UINT]
 def tree(menu):
  result=[]
  for i in range(u.GetMenuItemCount(menu)):
   label=C.create_unicode_buffer(512);u.GetMenuStringW(menu,i,label,512,0x400)
   flags=u.GetMenuState(menu,i,0x400);child=u.GetSubMenu(menu,i)
   result.append(dict(label=label.value.replace('&','').split('\t')[0],text=label.value,id=u.GetMenuItemID(menu,i),enabled=not bool(flags&3),checked=bool(flags&8),children=tree(child) if child else []))
  return result
 menus=tree(u.GetMenu(h)) if u.GetMenu(h) else []
 if mode=='menus':print(json.dumps(menus));sys.exit()
 path=sys.argv[4].split('/');items=menus
 for part in path:
  matches=[item for item in items if item['label']==part];assert len(matches)==1,(part,items)
  item=matches[0];items=item['children']
 assert not items and item['enabled'] and item['id']!=0xffffffff,item
 assert u.PostMessageW(h,0x111,item['id'],0),C.get_last_error()
 print(json.dumps(item));sys.exit()
elif mode=='menu-focus':
 class GUIINFO(C.Structure):
  _fields_=[('cbSize',W.DWORD),('flags',W.DWORD),('hwndActive',W.HWND),('hwndFocus',W.HWND),('hwndCapture',W.HWND),('hwndMenuOwner',W.HWND),('hwndMoveSize',W.HWND),('hwndCaret',W.HWND),('rcCaret',W.RECT)]
 u.GetGUIThreadInfo.argtypes=[W.DWORD,C.POINTER(GUIINFO)]
 info=GUIINFO();info.cbSize=C.sizeof(info)
 assert u.GetGUIThreadInfo(u.GetWindowThreadProcessId(h,None),C.byref(info)),C.get_last_error()
 print(json.dumps(dict(menuMode=bool(info.flags&4),menuOwner=info.hwndMenuOwner,window=h,flags=info.flags)));sys.exit()
elif mode in ['close','cancel-dialog']:u.PostMessageW(h,0x10,0,0)
elif mode=='keys':
 u.SetForegroundWindow.argtypes=[W.HWND];u.GetForegroundWindow.restype=W.HWND
 u.ShowWindow(h,9);u.SetForegroundWindow(h);time.sleep(.2)
 assert u.GetForegroundWindow()==h,'Foreground ownership could not be confirmed; no keys sent'
 keys={'CTRL':0x11,'ALT':0x12,'SHIFT':0x10,'F10':0x79,'F4':0x73,'ESC':0x1b,'COMMA':0xbc,'PLUS':0xbb,'MINUS':0xbd,'ENTER':0x0d}
 chord=[keys.get(k.upper(),ord(k.upper()) if len(k)==1 else 0) for k in sys.argv[4].split('+')]
 assert all(chord),chord
 for key in chord:u.keybd_event(key,0,0,0)
 for key in reversed(chord):u.keybd_event(key,0,2,0)
elif mode=='screenshot':
 u.GetForegroundWindow.restype=W.HWND
 assert u.GetForegroundWindow()==h,'Refusing to capture a window without foreground ownership'
 from PIL import ImageGrab
 ImageGrab.grab(bbox=tuple(selected[0]['rect'])).save(sys.argv[4])
elif mode=='minimize':u.ShowWindow(h,6)
elif mode=='restore':u.ShowWindow(h,9)
elif mode=='resize':u.SetWindowPos(h,None,0,0,int(sys.argv[4]),int(sys.argv[5]),6)
else:raise ValueError(mode)
print(json.dumps(selected[0]))
