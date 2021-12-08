# UPGRADE_POINT.
# See: https://hub.docker.com/_/python/
FROM python:3.9.9-bullseye

RUN apt update

# UPGRADE_POINT.
# See: https://github.com/nexB/scancode-toolkit/releases
ENV SCANCODE_URL=https://github.com/nexB/scancode-toolkit/releases/download/v30.1.0/scancode-toolkit-30.1.0_py39-linux.tar.xz
RUN wget ${SCANCODE_URL} \
	&& tar -xvf ./scancode-toolkit-*.tar.xz \
	&& rm -f ./scancode-toolkit-*.tar.xz \
	&& mv scancode-toolkit-*/ /scancode-toolkit

# Prepare ScanCode database and run it from anywhere.
WORKDIR /scancode-toolkit
RUN ./scancode --reindex-licenses
ENV PATH=/scancode-toolkit:$PATH

# UPGRADE_POINT.
# See: https://github.com/nodesource/distributions/blob/master/README.md#installation-instructions
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
RUN apt install -y nodejs
RUN npm install --global yarn

# UPGRADE_POINT.
# See: https://www.npmjs.com/package/ts-node
RUN yarn global add ts-node@10.4.0

# Useful for browsing files and the database.
RUN apt install -y less
RUN apt install -y sqlite3

# UPGRADE_POINT.
# See: https://github.com/aws/aws-cli/blob/v2/CHANGELOG.rst
ENV AWSCLI_VERSION=2.4.0
RUN curl --location https://awscli.amazonaws.com/awscli-exe-linux-x86_64-${AWSCLI_VERSION}.zip \
		--output ./awscli.zip \
	&& unzip ./awscli.zip \
	&& ./aws/install \
	&& rm -rf ./awscli.zip

# Pretty terminal with basic tab-completion.
# See: https://gist.github.com/scmx/242caa249b0ea343e2588adea14479e6
RUN apt install -y bash-completion
RUN echo '[[ $PS1 && -f /usr/share/bash-completion/bash_completion ]] && . /usr/share/bash-completion/bash_completion' >> ~/.bashrc
RUN echo 'export PS1="\n🐳 \[\033[1;36m\]\h \[\033[1;34m\]\$PWD\[\033[0;35m\] \[\033[1;36m\]# \[\033[0m\]"' >> ~/.bashrc

# Run tool from anywhere.
ENV PATH=/app:${PATH}

# Ignore irrelevant ScanCode warnings.
ENV PYTHONWARNINGS="ignore"

# Give Node more space.
ENV NODE_OPTIONS="--max_old_space_size=4096"

WORKDIR /app

COPY ./app/package.json ./
RUN yarn install
COPY ./app/lib/ ./lib/
COPY ./app/*.* ./

ENTRYPOINT [ "bash" ]
