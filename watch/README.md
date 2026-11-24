# 에스파크 워치 앱 (Apple Watch)

워치 단독 앱입니다. 아이폰 앱 없이 워치 GPS로 동작합니다.

- 1페이지: 남은 거리(그린 중앙 또는 앞/뒷핀), 그린 앞·뒤 거리, 추천 클럽, [샷 기록]
- 2페이지(아래로 스와이프): 샷·퍼트 +/−, [홀인] [OK] → 이글/버디/파/보기 판정, 누적 스코어
- 3페이지: 오늘 핀 위치(앞/중/뒤), 이전·다음 홀, 홀 선택, 스코어카드, 클럽 거리 수정, 라운드 종료

App Store 심사 없이 Xcode로 내 워치에 직접 설치합니다.

## 설치 (맥북, 처음 한 번 30~40분)

1. App Store에서 **Xcode** 설치 → 실행 → Xcode › Settings › Accounts › `+`로 Apple ID 로그인
2. 이 저장소 내려받기: GitHub `spark-golf` → Code → Download ZIP → 압축 풀기
3. Xcode › File › New › Project → 위쪽 **watchOS** 탭 → **App** → Next
   - Product Name `SparkWatch`, Team 본인 계정, Organization Identifier `com.jinhk93`
   - Interface SwiftUI, Language Swift, **Watch-only App** 선택 → 저장
4. 왼쪽 목록 `SparkWatch Watch App` 폴더의 `ContentView.swift`, `SparkWatchApp.swift` 선택 → Delete → Move to Trash
5. 내려받은 `watch/SparkWatch/` 안의 `.swift` 파일 5개를 그 폴더로 드래그 → **Copy items if needed** 체크 → Finish
6. 맨 위 파란 프로젝트 아이콘 → TARGETS `SparkWatch Watch App`
   - **Info** 탭: 행 위 `+` → `Privacy - Location When In Use Usage Description`, 값 `남은 거리 계산에 위치를 사용합니다`
   - **Signing & Capabilities** 탭: Team 확인 → `+ Capability` → **Background Modes** → **Location updates** 체크
   - **General** 탭: Minimum Deployments가 watchOS 10.0 이상인지 확인
7. 아이폰을 맥에 케이블로 연결(워치는 그 아이폰과 페어링된 상태)
   - 아이폰: 설정 › 개인정보 보호 및 보안 › **개발자 모드** 켜기(재시동)
   - 워치: 설정 › 개인정보 보호 및 보안 › **개발자 모드** 켜기
8. Xcode 위쪽 실행 대상에서 **내 Apple Watch** 선택 → ▶ 실행. 첫 설치는 5~10분 걸릴 수 있습니다.
9. 워치에서 위치 권한 **허용**

빌드 오류가 나면 빨간 오류 메시지 화면을 캡처해서 보내 주세요.

## 라운딩 전 설정

- 워치 설정 › 일반 › 시계로 돌아가기 › 에스파크 → **앱으로 돌아가기** 켜기, 시간 **1시간**
  (손목을 내렸다 올려도 앱 화면이 유지됨)
- 무료 Apple ID로 설치하면 **7일 후 만료** → 라운딩 1~2일 전에 맥에서 ▶ 한 번 더 실행.
  유료 개발자 계정이면 1년 유지.

## 참고

- 홀 좌표는 웹앱(`data.js`)과 같습니다. 아쿠아 1~3번은 추정 좌표입니다.
- 워치와 휴대폰 웹앱의 기록은 서로 합쳐지지 않습니다(워치=스코어 기록, 폰=홀 지도).
